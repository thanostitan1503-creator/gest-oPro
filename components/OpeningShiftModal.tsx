import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Factory, AlertTriangle, Save } from 'lucide-react';
// ⚠️ REMOVIDO v3.0: useLiveQuery (use useState + useEffect + Services)
import { useShift } from '@/contexts/ShiftContext';
// ⚠️ REMOVIDO v3.0: db local (use Services: import { xxxService } from '@/services')
import { getStockMapForDeposit } from '@/domain/repositories/stock.repo';
import { listProducts } from '@/domain/repositories/products.repo';
import type { Colaborador, Produto } from '@/domain/types';

type OpeningShiftModalProps = {
  user: Colaborador;
};

export const OpeningShiftModal: React.FC<OpeningShiftModalProps> = ({ user }) => {
  const { openShift } = useShift();
  const [openingBalance, setOpeningBalance] = useState('');
  const [countInputs, setCountInputs] = useState<Record<string, number | ''>>({});
  const [products, setProducts] = useState<Produto[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Se usuário tem depositoId, usar ele. Senão, permitir seleção
  const [selectedDepositId, setSelectedDepositId] = useState<string>(user.depositoId || '');

  const deposits = useLiveQuery(() => db.deposits?.toArray(), []) ?? [];
  
  const deposit = useLiveQuery(
    () => (selectedDepositId ? db.deposits.get(selectedDepositId) : undefined),
    [selectedDepositId]
  );
  const requireAudit =
    Boolean((deposit as any)?.require_stock_audit ?? (deposit as any)?.requireStockAudit);

  const resolveProductDepositId = (p: Produto) =>
    (p as any).deposit_id ?? (p as any).depositId ?? (p as any).depositoId ?? null;
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
      if (!selectedDepositId) return; // ⚠️ FIXADO: Usar selectedDepositId
      const loadedProducts = await listProducts();
      const scoped = loadedProducts.filter((p) => {
        if (isServiceProduct(p)) return false;
        const dep = resolveProductDepositId(p);
        return dep === null || dep === selectedDepositId;
      });
      const map = await getStockMapForDeposit(selectedDepositId);
      if (!alive) return;
      setProducts(scoped);
      setStockMap(map);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [selectedDepositId]); // ⚠️ FIXADO: Mudar dependência

  const missingAudit = useMemo(() => {
    if (!requireAudit) return false;
    if (!products.length) return false;
    return products.some((p) => countInputs[p.id] === '' || countInputs[p.id] === undefined);
  }, [requireAudit, products, countInputs]);

  const handleCountChange = (prodId: string, val: string) => {
    const num = parseInt(val);
    setCountInputs((prev) => ({
      ...prev,
      [prodId]: Number.isNaN(num) ? '' : Math.max(0, num),
    }));
  };

  const handleOpenShift = async () => {
    setError(null);
    
    // ✅ CORRIGIDO: Depósito vem automaticamente do usuário
    if (!selectedDepositId) {
      setError('Erro: Usuário sem depósito vinculado.');
      return;
    }
    
    const opening = Number(openingBalance.replace(',', '.'));
    if (!Number.isFinite(opening) || opening < 0) {
      setError('Informe um valor valido para o fundo de troco.');
      return;
    }
    if (missingAudit) {
      setError('Preencha a contagem inicial de estoque.');
      return;
    }

    setSaving(true);
    try {
      await openShift({ openingBalance: opening });
    } catch (err) {
      setError('Falha ao abrir o turno.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-surface border border-bdr rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-bdr flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <ClipboardCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-txt-main">Abertura de Caixa</h3>
            <p className="text-xs text-txt-muted">Turno obrigatorio para acesso ao sistema.</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ✅ Se chegou aqui sem depositoId, é GERENTE/ENTREGADOR (validado no login) */}
          {!user.depositoId && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-txt-main">
                Selecione o Depósito *
              </label>
              <select
                value={selectedDepositId}
                onChange={(e) => setSelectedDepositId(e.target.value)}
                className="w-full px-4 py-3 border border-bdr rounded-lg bg-app text-txt-main focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">-- Selecione um depósito --</option>
                {deposits.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-txt-muted">
                Selecione o depósito onde deseja abrir turno.
              </p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            </div>
          )}

          <div className="bg-app border border-bdr rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-app rounded-full border border-bdr">
                <Factory className="w-5 h-5 text-txt-muted" />
              </div>
              <div>
                <div className="text-xs text-txt-muted uppercase font-bold">Deposito</div>
                <div className="text-sm font-black text-txt-main">{deposit?.nome || 'Selecione um depósito'}</div>
              </div>
            </div>
            {requireAudit && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                <AlertTriangle className="w-4 h-4" />
                Auditoria de estoque obrigatoria
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold text-txt-muted uppercase ml-1">Fundo de Troco / Suprimento Inicial</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-txt-muted font-medium">R$</span>
                <input
                  type="number"
                  min="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-app border border-bdr rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-bold text-txt-main"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {requireAudit && products.length > 0 && (
            <div className="bg-app border border-bdr rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-bdr">
                <h4 className="text-xs font-black text-txt-muted uppercase tracking-widest">Contagem Inicial de Estoque</h4>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-surface text-[10px] text-txt-muted uppercase font-black border-b border-bdr">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3 text-center">Estoque Sistema</th>
                    <th className="px-4 py-3 text-center">Contado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-app/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-txt-main">{p.nome}</td>
                      <td className="px-4 py-3 text-center font-mono text-txt-muted">
                        {stockMap[p.id] ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={countInputs[p.id] ?? ''}
                          onChange={(e) => handleCountChange(p.id, e.target.value)}
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
        </div>

        <div className="px-6 py-4 border-t border-bdr bg-app flex justify-end">
          <button
            onClick={handleOpenShift}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-black text-sm flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Abrindo...' : 'Abrir Turno'}
          </button>
        </div>
      </div>
    </div>
  );
};



