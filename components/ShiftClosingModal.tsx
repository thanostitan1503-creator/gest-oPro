import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, ClipboardCheck, Save, X } from 'lucide-react';
import { useShift } from '@/contexts/ShiftContext';
import type { Produto, ShiftStockAudit } from '@/domain/types';
import { useLiveQuery, db } from '@/utils/legacyHelpers';

interface ShiftClosingModalProps {
  onClose: () => void;
}

const toNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ShiftClosingModal: React.FC<ShiftClosingModalProps> = ({ onClose }) => {
  const { activeShift, closeShift } = useShift();
  const [declared, setDeclared] = useState({ cash: '', card: '', pix: '' });
  const [stockCounts, setStockCounts] = useState<Record<string, number | ''>>({});
  const [products, setProducts] = useState<Produto[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [showSystem, setShowSystem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultStatus, setResultStatus] = useState<'CLOSED' | 'DISCREPANCY' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deposit = useLiveQuery(
    () => (activeShift?.depositoId ? db.deposits.get(activeShift.depositoId) : undefined),
    [activeShift?.depositoId]
  );
  const requireAudit =
    Boolean((deposit as any)?.require_stock_audit ?? (deposit as any)?.requireStockAudit);

  const cashFlowEntries = useLiveQuery(
    () => (activeShift?.id ? db.cash_flow_entries.where('shift_id').equals(activeShift.id).toArray() : []),
    [activeShift?.id]
  );

  const resolveProductDepositId = (p: Produto) =>
    (p as any).depositoId ?? null; // ✅ Já normalizado
  const isDeliveryFeeProduct = (p: Produto) => {
    const flag = (p as any).is_delivery_fee ?? (p as any).isDeliveryFee;
    if (flag === true) return true;
    const group = String((p as any).product_group ?? (p as any).codigo ?? '').toLowerCase();
    if (group === 'delivery_fee') return true;
    const name = String((p as any).nome ?? '').toLowerCase();
    return name === 'taxa de entrega';
  };
  const isServiceProduct = (p: Produto) => {
    if (isDeliveryFeeProduct(p)) return true;
    const track = (p as any).track_stock ?? (p as any).trackStock;
    if (track === false) return true;
    return (p as any).type === 'SERVICE';
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!activeShift?.depositoId) return; // ✅ camelCase
      const loaded = await db.products.toArray();
      const scoped = loaded.filter((p) => {
        if (isServiceProduct(p)) return false;
        const dep = resolveProductDepositId(p);
        return dep === null || dep === activeShift.depositoId; // ✅ camelCase
      });
      const map = await getStockMapForDeposit(activeShift.depositoId); // ✅ camelCase
      if (!alive) return;
      setProducts(scoped);
      setStockMap(map);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [activeShift?.depositoId]); // ✅ camelCase

  const systemTotals = useMemo(() => {
    const totals = { cash: 0, card: 0, pix: 0 };
    (cashFlowEntries || []).forEach((entry: any) => {
      const amount = Number(entry.amount ?? 0) || 0;
      const signed = entry.direction === 'OUT' ? -amount : amount;
      const paymentType = entry.payment_type ?? (entry.category === 'SALE' ? 'other' : 'cash');
      if (paymentType === 'cash') totals.cash += signed;
      if (paymentType === 'card') totals.card += signed;
      if (paymentType === 'pix') totals.pix += signed;
    });
    return totals;
  }, [cashFlowEntries]);

  const missingAudit = useMemo(() => {
    if (!requireAudit) return false;
    if (!products.length) return false;
    return products.some((p) => stockCounts[p.id] === '' || stockCounts[p.id] === undefined);
  }, [requireAudit, products, stockCounts]);

  const handleStockChange = (prodId: string, value: string) => {
    const num = parseInt(value);
    setStockCounts((prev) => ({
      ...prev,
      [prodId]: Number.isNaN(num) ? '' : Math.max(0, num),
    }));
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    setError(null);
    const declaredCash = toNumber(declared.cash);
    const declaredCard = toNumber(declared.card);
    const declaredPix = toNumber(declared.pix);
    if (declaredCash < 0 || declaredCard < 0 || declaredPix < 0) {
      setError('Valores declarados invalidos.');
      return;
    }
    if (missingAudit) {
      setError('Preencha a contagem de estoque antes de fechar.');
      return;
    }

    const diffCash = declaredCash - systemTotals.cash;
    const diffCard = declaredCard - systemTotals.card;
    const diffPix = declaredPix - systemTotals.pix;
    const hasCashDiff = Math.abs(diffCash) > 0.009 || Math.abs(diffCard) > 0.009 || Math.abs(diffPix) > 0.009;

    const audits: ShiftStockAudit[] = [];
    if (requireAudit) {
      products.forEach((p) => {
        const counted = stockCounts[p.id];
        if (counted === '' || counted === undefined) return;
        const systemQty = Number(stockMap[p.id] ?? 0) || 0;
        const diffQty = Number(counted) - systemQty;
        if (diffQty === 0) return;
        audits.push({
          id: crypto.randomUUID(),
          shift_id: activeShift.id,
          depositoId: activeShift.depositoId, // ✅ camelCase
          product_id: p.id,
          counted_qty: Number(counted),
          system_qty: systemQty,
          diff_qty: diffQty,
          created_at: Date.now(),
          user_id: activeShift.user_id,
        });
      });
    }

    const status = hasCashDiff || audits.length > 0 ? 'DISCREPANCY' : 'CLOSED';

    setSaving(true);
    try {
      if (audits.length > 0) {
        await saveShiftStockAudits(audits);
      }
      await closeShift({
        declared: { cash: declaredCash, card: declaredCard, pix: declaredPix },
        system: systemTotals,
        status,
        notes: status === 'DISCREPANCY' ? 'Discrepancia detectada no fechamento.' : null,
      });
      setResultStatus(status);
    } catch (err) {
      setError('Falha ao fechar o turno.');
    } finally {
      setSaving(false);
    }
  };

  if (!activeShift && !resultStatus) {
    return (
      <div className="fixed inset-0 bg-app z-50 flex items-center justify-center text-txt-muted">
        Nenhum turno aberto para fechamento.
      </div>
    );
  }

  if (resultStatus) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
        <div className="bg-surface border border-bdr rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${resultStatus === 'DISCREPANCY' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            <AlertTriangle className={`w-6 h-6 ${resultStatus === 'DISCREPANCY' ? 'text-red-500' : 'text-emerald-500'}`} />
          </div>
          <h3 className="text-base font-black text-txt-main">Turno Finalizado</h3>
          <p className="text-sm text-txt-muted">
            {resultStatus === 'DISCREPANCY'
              ? 'Diferenca identificada. O gerente sera notificado.'
              : 'Fechamento concluido sem divergencias.'}
          </p>
          <button
            onClick={onClose}
            className="w-full bg-primary text-white py-2 rounded-lg font-black"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-colors">
      <div className="bg-surface border-b border-bdr px-6 py-3 shadow-sm shrink-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-lg shadow-sm">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-txt-main">Fechamento de Caixa</h2>
            <p className="text-xs text-txt-muted">Turno #{activeShift?.id.slice(-6)}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-red-500/10 rounded-full text-txt-muted hover:text-red-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-app p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-surface rounded-xl border border-bdr overflow-hidden">
            <div className="px-6 py-4 border-b border-bdr bg-app/50 flex items-center justify-between">
              <h3 className="text-sm font-black text-txt-main uppercase tracking-wide flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                Conferencia Cega
              </h3>
              {!showSystem && (
                <button
                  onClick={() => setShowSystem(true)}
                  className="text-xs font-black text-txt-main bg-app border border-bdr px-3 py-1 rounded"
                >
                  Mostrar valores do sistema
                </button>
              )}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {([
                { key: 'cash', label: 'Dinheiro' },
                { key: 'card', label: 'Cartao' },
                { key: 'pix', label: 'Pix' },
              ] as const).map((item) => (
                <div key={item.key} className="space-y-2">
                  <label className="text-xs font-bold text-txt-muted uppercase">{item.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-txt-muted font-medium">R$</span>
                    <input
                      type="number"
                      value={declared[item.key]}
                      onChange={(e) => setDeclared((prev) => ({ ...prev, [item.key]: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 bg-app border border-bdr rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-bold text-txt-main"
                      placeholder="0.00"
                    />
                  </div>
                  {showSystem && (
                    <div className="text-[11px] text-txt-muted">
                      Sistema: R$ {systemTotals[item.key].toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {requireAudit && products.length > 0 && (
            <div className="bg-surface rounded-xl border border-bdr overflow-hidden">
              <div className="px-6 py-4 border-b border-bdr bg-app/50">
                <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">Auditoria de Estoque</h3>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-surface text-[10px] text-txt-muted uppercase font-black border-b border-bdr">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3 text-center">Sistema</th>
                    <th className="px-4 py-3 text-center">Contado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-app/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-txt-main">{p.nome}</td>
                      <td className="px-4 py-3 text-center font-mono text-txt-muted">{stockMap[p.id] ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={stockCounts[p.id] ?? ''}
                          onChange={(e) => handleStockChange(p.id, e.target.value)}
                          className="w-24 text-center font-black bg-surface border border-bdr rounded-lg py-1 text-txt-main focus:ring-2 focus:ring-primary/20 outline-none"
                          placeholder="-"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && (
            <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleCloseShift}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black shadow-lg disabled:opacity-60 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Fechando...' : 'Fechar Turno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



