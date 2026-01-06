import { db, OutboxEventRow } from '../db';
import { listSyncableOutboxEvents, markOutboxFailed, markOutboxSent } from './outbox';
import {
  applyDepositDelete,
  applyDepositUpsert,
  applyEmployeeDelete,
  applyEmployeeUpsert,
  applyProductDelete,
  applyProductUpsert,
  applyClientDelete,
  applyClientUpsert,
  applyClientPriceOverrideDelete,
  applyClientPriceOverrideUpsert,
  applyClientOneTimeDiscountDelete,
  applyClientOneTimeDiscountUpsert,
  applyServiceOrderDelete,
  applyServiceOrderUpsert,
  applyStockMovementDelete,
  applyStockMovementUpsert,
  applyPaymentMethodDelete,
  applyPaymentMethodUpsert,
  applyAccountsReceivableDelete,
  applyAccountsReceivableUpsert,
  applyReceivablePaymentDelete,
  applyReceivablePaymentUpsert,
  applyExpenseDelete,
  applyExpenseUpsert,
  applyFinancialSettingsDelete,
  applyFinancialSettingsUpsert,
  applyWorkShiftDelete,
  applyWorkShiftUpsert,
  applyCashFlowEntryDelete,
  applyCashFlowEntryUpsert,
  applyShiftStockAuditDelete,
  applyShiftStockAuditUpsert,
  applyDeliveryZoneDelete,
  applyDeliveryZoneUpsert,
  applyDeliverySectorDelete,
  applyDeliverySectorUpsert,
  applyZonePricingDelete,
  applyZonePricingUpsert,
  applyProductPricingDelete,
  applyProductPricingUpsert,
  applyProductExchangeRuleDelete,
  applyProductExchangeRuleUpsert,
} from './supabaseAppliers';

let started = false;
let syncing = false;
let intervalId: number | undefined;

function isOnline() {
  // navigator pode não existir em SSR, mas aqui é SPA.
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

async function applyEvent(event: OutboxEventRow) {
  switch (event.entity) {
    case 'products':
      if (event.action === 'DELETE') return applyProductDelete(event.entity_id);
      return applyProductUpsert(event.payload_json);

    case 'deposits':
      if (event.action === 'DELETE') return applyDepositDelete(event.entity_id);
      return applyDepositUpsert(event.payload_json);

    case 'employees':
      if (event.action === 'DELETE') return applyEmployeeDelete(event.entity_id);
      return applyEmployeeUpsert(event.payload_json);

    case 'clients':
      if (event.action === 'DELETE') return applyClientDelete(event.entity_id);
      return applyClientUpsert(event.payload_json);

    case 'client_price_overrides':
      if (event.action === 'DELETE') return applyClientPriceOverrideDelete(event.entity_id);
      return applyClientPriceOverrideUpsert(event.payload_json);

    case 'client_one_time_discount':
      if (event.action === 'DELETE') return applyClientOneTimeDiscountDelete(event.entity_id);
      return applyClientOneTimeDiscountUpsert(event.payload_json);

    case 'service_orders':
      if (event.action === 'DELETE') return applyServiceOrderDelete(event.entity_id);
      return applyServiceOrderUpsert(event.payload_json);

    case 'stock_movements':
      if (event.action === 'DELETE') return applyStockMovementDelete(event.entity_id);
      return applyStockMovementUpsert(event.payload_json);

    case 'payment_methods':
      if (event.action === 'DELETE') return applyPaymentMethodDelete(event.entity_id);
      return applyPaymentMethodUpsert(event.payload_json);

    case 'receivables':
    case 'accounts_receivable':
      if (event.action === 'DELETE') return applyAccountsReceivableDelete(event.entity_id);
      return applyAccountsReceivableUpsert(event.payload_json);

    case 'financial_settings':
      if (event.action === 'DELETE') return applyFinancialSettingsDelete(event.entity_id);
      return applyFinancialSettingsUpsert(event.payload_json);

    case 'receivable_payments':
      if (event.action === 'DELETE') return applyReceivablePaymentDelete(event.entity_id);
      return applyReceivablePaymentUpsert(event.payload_json);

    case 'expenses':
      if (event.action === 'DELETE') return applyExpenseDelete(event.entity_id);
      return applyExpenseUpsert(event.payload_json);

    case 'work_shifts':
      if (event.action === 'DELETE') return applyWorkShiftDelete(event.entity_id);
      return applyWorkShiftUpsert(event.payload_json);

    case 'cash_flow_entries':
      if (event.action === 'DELETE') return applyCashFlowEntryDelete(event.entity_id);
      return applyCashFlowEntryUpsert(event.payload_json);

    case 'shift_stock_audits':
      if (event.action === 'DELETE') return applyShiftStockAuditDelete(event.entity_id);
      return applyShiftStockAuditUpsert(event.payload_json);

    case 'delivery_zones':
      if (event.action === 'DELETE') return applyDeliveryZoneDelete(event.entity_id);
      return applyDeliveryZoneUpsert(event.payload_json);

    case 'delivery_sectors':
      if (event.action === 'DELETE') return applyDeliverySectorDelete(event.entity_id);
      return applyDeliverySectorUpsert(event.payload_json);

    case 'zone_pricing':
      if (event.action === 'DELETE') return applyZonePricingDelete(event.entity_id);
      return applyZonePricingUpsert(event.payload_json);

    case 'product_pricing':
      if (event.action === 'DELETE') return applyProductPricingDelete(event.entity_id);
      return applyProductPricingUpsert(event.payload_json);

    case 'product_exchange_rules':
      if (event.action === 'DELETE') return applyProductExchangeRuleDelete(event.entity_id);
      return applyProductExchangeRuleUpsert(event.payload_json);

    default:
      // Entidade ainda não suportada no sync (mantém na fila como FAILED para visibilidade)
      throw new Error(`Outbox entity not supported yet: ${event.entity}`);
  }
}

export async function syncNow(options?: { limit?: number; log?: boolean }) {
  if (syncing) return;
  if (!isOnline()) return;

  syncing = true;
  const limit = options?.limit ?? 50;
  const log = options?.log ?? false;

  try {
    // Garante que a DB está aberta antes de sincronizar
    await db.open();

    const events = await listSyncableOutboxEvents(limit);
    if (log && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('SYNC_OUTBOX_START', { count: events.length });
    }

    // ⚠️ PRIORIZAÇÃO: Sincronizar entidades base PRIMEIRO (evita erros de FK)
    const priorityOrder = [
      'deposits',           // 1º: Depósitos (base de tudo)
      'employees',          // 2º: Colaboradores
      'clients',            // 3º: Clientes
      'payment_methods',    // 4º: Formas de pagamento
      'delivery_zones',     // 5º: Zonas de entrega
      'products',           // 6º: Produtos
      'delivery_sectors',   // 7º: Setores (dependem de zones)
      'zone_pricing',       // 8º: Preços de zona (dependem de zones + deposits)
      'product_pricing',    // 9º: Preços de produto (dependem de products + deposits)
      'service_orders',     // 10º: Ordens de serviço
      'stock_movements',    // 11º: Movimentos de estoque (dependem de products + deposits)
      'work_shifts',        // 12º: Turnos
      'accounts_receivable', // 13º: Contas a receber
      // Resto em qualquer ordem
    ];

    const hasProductReturnRef = (payload: any): boolean => {
      if (!payload || typeof payload !== 'object') return false;
      return Boolean(
        payload.return_product_id ??
          payload.returnProductId ??
          payload.produtoCascoId ??
          payload.produto_casco_id
      );
    };

    // ⚠️ Ordenação estável: prioridade da entidade + regras internas por entidade
    const sortedEvents = events
      .map((ev, idx) => ({ ev, idx }))
      .sort((a, b) => {
        const aPriority = priorityOrder.indexOf(a.ev.entity);
        const bPriority = priorityOrder.indexOf(b.ev.entity);

        // Se não está na lista de prioridade, vai para o final
        const aIndex = aPriority === -1 ? 9999 : aPriority;
        const bIndex = bPriority === -1 ? 9999 : bPriority;
        if (aIndex !== bIndex) return aIndex - bIndex;

        // Regra interna: em products, sincroniza primeiro os sem return_product_id
        if (a.ev.entity === 'products' && b.ev.entity === 'products') {
          const aHas = hasProductReturnRef(a.ev.payload_json);
          const bHas = hasProductReturnRef(b.ev.payload_json);
          if (aHas !== bHas) return aHas ? 1 : -1;
        }

        // Mantém uma ordenação previsível
        const aCreated = a.ev.created_at ?? 0;
        const bCreated = b.ev.created_at ?? 0;
        if (aCreated !== bCreated) return aCreated - bCreated;
        return a.idx - b.idx;
      })
      .map((x) => x.ev);

    // ⚠️ RASTREIA ENTIDADES QUE FALHARAM PARA EVITAR ERROS DE FK EM CASCATA
    const failedEntities = new Set<string>();
    
    // Define quais entidades dependem de quais
    const dependencies: Record<string, string[]> = {
      'products': ['deposits'],
      'employees': ['deposits'],
      'clients': ['deposits', 'delivery_zones'],
      'stock_movements': ['deposits', 'products'],
      'service_orders': ['deposits', 'clients', 'products'],
      'product_pricing': ['deposits', 'products'],
      'zone_pricing': ['deposits', 'delivery_zones'],
      'delivery_sectors': ['delivery_zones'],
      'accounts_receivable': ['deposits', 'clients'],
    };

    for (const ev of sortedEvents) {
      // ⚠️ VERIFICA SE ALGUMA DEPENDÊNCIA FALHOU
      const deps = dependencies[ev.entity] || [];
      const blockedBy = deps.filter(dep => failedEntities.has(dep));
      
      if (blockedBy.length > 0) {
        // Não tenta sincronizar - dependência falhou
        if (log && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('SYNC_OUTBOX_SKIP', { 
            id: ev.id, 
            entity: ev.entity, 
            reason: `Dependências falharam: ${blockedBy.join(', ')}` 
          });
        }
        // Marca como PENDING para tentar novamente depois
        await db.outbox_events.update(ev.id, {
          last_error: `Bloqueado: dependências falharam (${blockedBy.join(', ')})`,
        });
        continue;
      }

      try {
        await applyEvent(ev);
        await markOutboxSent(ev.id);
      } catch (e) {
        await markOutboxFailed(ev.id, e);
        
        // ⚠️ MARCA A ENTIDADE COMO FALHADA
        failedEntities.add(ev.entity);
        
        if (log && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('SYNC_OUTBOX_FAIL', { id: ev.id, entity: ev.entity, action: ev.action, error: e });
        }
      }
    }

    if (log && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('SYNC_OUTBOX_DONE');
    }
  } finally {
    syncing = false;
  }
}

export function startSyncService() {
  if (started) return;
  started = true;

  // Dispara uma sync assim que possível
  if (isOnline()) void syncNow({ log: true });

  // Quando voltar internet, sincroniza
  window.addEventListener('online', () => {
    void syncNow({ log: true });
  });

  // Polling leve quando online (evita ficar preso se um evento falhar e depois “destravar”)
  intervalId = window.setInterval(() => {
    if (!isOnline()) return;
    void syncNow({ log: false });
  }, 10_000);
}

export function stopSyncService() {
  if (!started) return;
  if (intervalId) window.clearInterval(intervalId);
  intervalId = undefined;
  started = false;
}
