import { SystemAlert } from './types';
import { getAlertsConfig } from './storage';
import { listDeposits, listProducts, getStockMapForDeposit, listReceivables } from './repositories';

const isDeliveryFeeProduct = (product: any) => {
  const flag = product?.is_delivery_fee ?? product?.isDeliveryFee;
  if (flag === true) return true;
  const group = String(product?.product_group ?? product?.codigo ?? '').toLowerCase();
  if (group === 'delivery_fee') return true;
  const name = String(product?.nome ?? '').toLowerCase();
  return name === 'taxa de entrega';
};

const isServiceProduct = (product: any) => {
  if (isDeliveryFeeProduct(product)) return true;
  const track = product?.track_stock ?? product?.trackStock;
  if (track === false) return true;
  return product?.type === 'SERVICE';
};

/**
 * Scans the entire system (Stock, Finance, Margins) based on configuration
 * and returns a list of active alerts.
 */
export async function scanSystemForAlerts(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];
  const config = getAlertsConfig();
  const [products, deposits] = await Promise.all([listProducts(), listDeposits()]);
  const resolveProductDepositId = (p: any) =>
    p?.deposit_id ?? p?.depositId ?? p?.depositoId ?? p?.deposito_id ?? null;

  // 1. STOCK ALERTS
  if (config.enabledStock) {
    for (const deposit of deposits.filter((d) => d.ativo)) {
      const depositStock = await getStockMapForDeposit(deposit.id);

      for (const prod of products.filter((p) => p.ativo && p.tipo !== 'OUTROS')) {
        if (isServiceProduct(prod)) continue;
        const productDepositId = resolveProductDepositId(prod);
        if (productDepositId !== deposit.id) continue;
        const qty = depositStock[prod.id] || 0;
        const min = config.minStock[prod.id] || 0;

        if (min > 0 && qty <= min) {
          const isCritical = qty === 0;
          alerts.push({
            id: `stock-${deposit.id}-${prod.id}`,
            type: 'STOCK',
            severity: isCritical ? 'CRITICAL' : 'WARNING',
            title: isCritical ? 'Estoque Zerado' : 'Estoque Mínimo',
            message: `O produto ${prod.nome} está com ${qty} un. (Mín: ${min})`,
            location: deposit.nome,
            details: { produtoId: prod.id, depositoId: deposit.id, qty, min },
          });
        }
      }
    }
  }

  // 2. MARGIN ALERTS
  if (config.enabledMargin) {
    products
      .filter((p) => p.ativo && p.preco_custo > 0)
      .forEach((prod) => {
        if (isServiceProduct(prod)) return;
        const margin = ((prod.preco_padrao - prod.preco_custo) / prod.preco_custo) * 100;

        if (margin < config.minMarginPercent) {
          alerts.push({
            id: `margin-${prod.id}`,
            type: 'MARGIN',
            severity: margin <= 0 ? 'CRITICAL' : 'WARNING',
            title: 'Margem Baixa',
            message: `${prod.nome} está com margem de ${margin.toFixed(1)}% (Meta: ${config.minMarginPercent}%)`,
            location: 'Tabela de Preços',
            details: { produtoId: prod.id, margin, target: config.minMarginPercent },
          });
        }
      });
  }

  // 3. FINANCIAL ALERTS
  if (config.enabledFinancial) {
    const receivables = await listReceivables();
    const now = Date.now();
    const noticeDays = Math.max(1, config.financialDaysNotice ?? 1);

    receivables
      .filter((r) => r.status !== 'PAGO' && !r.is_personal)
      .forEach((r) => {
        const total = Number(r.valor_total ?? 0);
        const paid = Number(r.valor_pago ?? 0);
        const remaining = Math.max(0, total - paid);
        const due = r.vencimento_em;
        if (!Number.isFinite(due) || remaining <= 0) return;

        const daysDiff = Math.floor((due - now) / (1000 * 60 * 60 * 24));
        const title = r.devedor_nome || r.description || 'Conta a Receber';
        const id = `fin-${r.id}`;

        if (due < now) {
          alerts.push({
            id,
            type: 'FINANCIAL',
            severity: 'CRITICAL',
            title: 'Conta a receber vencida',
            message: `${title} está vencida. Valor pendente: R$ ${remaining.toFixed(2)}`,
            location: 'Financeiro',
          });
        } else if (daysDiff <= (r.alert_days_before ?? noticeDays)) {
          alerts.push({
            id,
            type: 'FINANCIAL',
            severity: 'WARNING',
            title: 'Conta a receber próxima do vencimento',
            message: `${title} vence em ${daysDiff} dia(s). Valor pendente: R$ ${remaining.toFixed(2)}`,
            location: 'Financeiro',
          });
        }
      });
  }

  return alerts;
}

export function getRobotMood(alerts: SystemAlert[]): 'happy' | 'worried' | 'critical' {
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;

  if (criticalCount > 0) return 'critical';
  if (warningCount > 0) return 'worried';
  return 'happy';
}
