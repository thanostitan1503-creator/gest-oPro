import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Warehouse, ArrowLeftRight, Plus, Save, RefreshCw, X } from 'lucide-react';
import { db, generateId } from '../domain/db';
import { Colaborador, Deposit, Produto } from '../domain/types';
import { upsertDeposit, deleteDeposit } from '../domain/repositories/deposits.repo';
import { listProducts } from '../domain/repositories/products.repo';
import { applyMovements } from '../domain/repositories/stock.repo';

type Props = {
  onClose: () => void;
  currentUser: Colaborador;
};

type DepositForm = {
  id?: string;
  nome: string;
  endereco?: string;
  cor?: string;
  ativo: boolean;
};

type TransferForm = {
  productId: string;
  fromDepositId: string;
  toDepositId: string;
  quantidade: number;
};

type AdjustmentForm = {
  productId: string;
  depositId: string;
  novaQuantidade: number;
};

const defaultDepositForm: DepositForm = {
  nome: '',
  endereco: '',
  cor: '#9CA3AF',
  ativo: true,
};

const defaultTransfer: TransferForm = {
  productId: '',
  fromDepositId: '',
  toDepositId: '',
  quantidade: 1,
};

const defaultAdjustment: AdjustmentForm = {
  productId: '',
  depositId: '',
  novaQuantidade: 0,
};

const isTrackedProduct = (p: any) => {
  if (!p) return false;
  const track = p.track_stock ?? p.trackStock;
  const isService = p.type === 'SERVICE';
  const isDeliveryFee = p.is_delivery_fee ?? p.isDeliveryFee;
  return track !== false && !isService && !isDeliveryFee;
};

const getDepositId = (p: any): string | null => p?.depositoId ?? p?.deposit_id ?? p?.depositId ?? null;

export const StockManagementModule: React.FC<Props> = ({ onClose, currentUser }) => {
  const deposits = useLiveQuery(() => db.deposits.toArray(), []) ?? [];
  const products = useLiveQuery(async () => {
    // Usa repositório para normalizar depositoId
    return await listProducts();
  }, []) ?? [];
  const balances = useLiveQuery(() => db.stock_balance.toArray(), []) ?? [];

  const [depositForm, setDepositForm] = useState<DepositForm>({ ...defaultDepositForm });
  const [transferForm, setTransferForm] = useState<TransferForm>({ ...defaultTransfer });
  const [adjustForm, setAdjustForm] = useState<AdjustmentForm>({ ...defaultAdjustment });
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [savingAdjust, setSavingAdjust] = useState(false);

  const depositOptions = useMemo(() => deposits.filter((d) => d.ativo !== false), [deposits]);

  const stockMatrix = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    balances.forEach((row) => {
      if (!map[row.deposit_id]) map[row.deposit_id] = {};
      map[row.deposit_id][row.product_id] = Number(row.quantidade_atual ?? 0) || 0;
    });

    // Fallback para produtos sem registro na stock_balance
    products.forEach((p) => {
      const depId = getDepositId(p);
      if (!depId) return;
      if (!map[depId]) map[depId] = {};
      const current = map[depId][p.id];
      if (current === undefined) {
        const fallback = Number((p as any).current_stock ?? 0) || 0;
        map[depId][p.id] = fallback;
      }
    });

    return map;
  }, [balances, products]);

  const trackedProducts = useMemo(() => products.filter(isTrackedProduct), [products]);

  const handleEditDeposit = (dep: Deposit) => {
    setDepositForm({
      id: dep.id,
      nome: dep.nome,
      endereco: dep.endereco,
      cor: dep.cor,
      ativo: dep.ativo !== false,
    });
  };

  const handleSaveDeposit = async () => {
    if (!depositForm.nome.trim()) {
      alert('Informe o nome do depósito.');
      return;
    }
    setSavingDeposit(true);
    try {
      const payload: Deposit = {
        id: depositForm.id ?? generateId(),
        nome: depositForm.nome.trim(),
        endereco: depositForm.endereco?.trim() || undefined,
        cor: depositForm.cor || undefined,
        ativo: depositForm.ativo,
      } as Deposit;
      await upsertDeposit(payload);
      setDepositForm({ ...defaultDepositForm });
    } catch (err) {
      console.error(err);
      alert('Não foi possível salvar o depósito.');
    } finally {
      setSavingDeposit(false);
    }
  };

  const handleDeleteDeposit = async (id: string) => {
    if (!confirm('Deseja remover este depósito?')) return;
    try {
      await deleteDeposit(id);
    } catch (err) {
      console.error(err);
      alert('Não foi possível remover o depósito.');
    }
  };

  const handleTransfer = async () => {
    const { productId, fromDepositId, toDepositId, quantidade } = transferForm;
    if (!productId || !fromDepositId || !toDepositId) {
      alert('Selecione produto e depósitos de origem/destino.');
      return;
    }
    if (fromDepositId === toDepositId) {
      alert('Depósitos devem ser diferentes.');
      return;
    }
    if (quantidade <= 0) {
      alert('Quantidade deve ser maior que zero.');
      return;
    }

    const product = trackedProducts.find((p) => p.id === productId);
    if (!product) {
      alert('Produto inválido.');
      return;
    }

    const produtoNome = product.nome;
    const usuarioId = currentUser?.id ?? 'system';
    const usuarioNome = currentUser?.nome ?? 'Sistema';
    const nowIso = new Date().toISOString();

    setSavingTransfer(true);
    try {
      await applyMovements([
        {
          id: generateId(),
          dataHora: nowIso,
          depositoId: fromDepositId,
          produtoId: productId,
          produtoNome,
          tipo: 'SAIDA',
          quantidade,
          origem: 'AJUSTE_MANUAL',
          usuarioId,
          usuarioNome,
          motivo: 'Transferência entre depósitos',
          meta: { direction: 'OUT', to: toDepositId },
        },
        {
          id: generateId(),
          dataHora: nowIso,
          depositoId: toDepositId,
          produtoId: productId,
          produtoNome,
          tipo: 'ENTRADA',
          quantidade,
          origem: 'AJUSTE_MANUAL',
          usuarioId,
          usuarioNome,
          motivo: 'Transferência entre depósitos',
          meta: { direction: 'IN', from: fromDepositId },
        },
      ]);
      setTransferForm({ ...defaultTransfer });
    } catch (err) {
      console.error(err);
      alert('Não foi possível registrar a transferência.');
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleAdjust = async () => {
    const { productId, depositId, novaQuantidade } = adjustForm;
    if (!productId || !depositId) {
      alert('Selecione produto e depósito.');
      return;
    }
    if (novaQuantidade < 0) {
      alert('Quantidade não pode ser negativa.');
      return;
    }

    const product = trackedProducts.find((p) => p.id === productId);
    if (!product) {
      alert('Produto inválido.');
      return;
    }

    const currentQty = stockMatrix[depositId]?.[productId] ?? 0;
    const divergence = novaQuantidade - currentQty;
    if (divergence === 0) {
      alert('Nenhuma diferença encontrada.');
      return;
    }

    const usuarioId = currentUser?.id ?? 'system';
    const usuarioNome = currentUser?.nome ?? 'Sistema';
    const nowIso = new Date().toISOString();

    setSavingAdjust(true);
    try {
      await applyMovements([
        {
          id: generateId(),
          dataHora: nowIso,
          depositoId: depositId,
          produtoId: productId,
          produtoNome: product.nome,
          tipo: 'AJUSTE_CONTAGEM',
          quantidade: novaQuantidade,
          origem: 'TELA_CONTAGEM_MOVIMENTACAO',
          usuarioId,
          usuarioNome,
          motivo: 'Ajuste manual de estoque',
          meta: { beforeQty: currentQty, afterQty: novaQuantidade, divergence },
        },
      ]);
      setAdjustForm({ ...defaultAdjustment });
    } catch (err) {
      console.error(err);
      alert('Não foi possível ajustar o estoque.');
    } finally {
      setSavingAdjust(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-6xl bg-surface border border-bdr rounded-3xl shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-bdr bg-app/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-2">
              <Warehouse className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-txt-muted">Gestão Central</p>
              <h2 className="text-xl font-black text-txt-main">Depósitos & Estoque</h2>
              <p className="text-xs text-txt-muted">Cadastre depósitos, veja quantidades e transfira entre unidades.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-txt-muted hover:text-txt-main hover:bg-app transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] divide-y xl:divide-y-0 xl:divide-x divide-bdr">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-txt-main uppercase tracking-widest">Depósitos</h3>
              <button
                onClick={() => setDepositForm({ ...defaultDepositForm })}
                className="inline-flex items-center gap-2 text-xs font-bold text-txt-muted hover:text-txt-main"
              >
                <RefreshCw className="w-4 h-4" />
                Limpar
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Nome</label>
                <input
                  className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  value={depositForm.nome}
                  onChange={(e) => setDepositForm((s) => ({ ...s, nome: e.target.value }))}
                  placeholder="Ex: Depósito Central"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Endereço</label>
                <input
                  className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  value={depositForm.endereco ?? ''}
                  onChange={(e) => setDepositForm((s) => ({ ...s, endereco: e.target.value }))}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Cor</label>
                  <input
                    type="color"
                    className="h-10 w-full rounded-lg border border-bdr bg-app"
                    value={depositForm.cor || '#9CA3AF'}
                    onChange={(e) => setDepositForm((s) => ({ ...s, cor: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    type="checkbox"
                    id="deposit-active"
                    className="w-4 h-4"
                    checked={depositForm.ativo}
                    onChange={(e) => setDepositForm((s) => ({ ...s, ativo: e.target.checked }))}
                  />
                  <label htmlFor="deposit-active" className="text-sm font-semibold text-txt-main">Ativo</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDeposit}
                  disabled={savingDeposit}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 text-white font-black uppercase tracking-wide px-3 py-2 shadow-lg shadow-purple-500/20 disabled:opacity-60"
                >
                  {savingDeposit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {depositForm.id ? 'Atualizar depósito' : 'Salvar depósito'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Lista</p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {deposits.length === 0 && <p className="text-sm text-txt-muted">Nenhum depósito cadastrado.</p>}
                {deposits.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between rounded-lg border border-bdr bg-app px-3 py-2">
                    <div>
                      <p className="text-sm font-bold text-txt-main">{dep.nome}</p>
                      <p className="text-[11px] text-txt-muted">{dep.endereco || 'Sem endereço'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${dep.ativo !== false ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {dep.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                      <button
                        className="text-xs font-bold text-blue-500 hover:text-blue-600"
                        onClick={() => handleEditDeposit(dep)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-xs font-bold text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteDeposit(dep.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="rounded-2xl border border-bdr bg-app p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-txt-muted">Transferência</p>
                    <h4 className="text-sm font-black text-txt-main">Mover estoque entre depósitos</h4>
                  </div>
                  <ArrowLeftRight className="w-5 h-5 text-txt-muted" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Produto</label>
                  <select
                    className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                    value={transferForm.productId}
                    onChange={(e) => setTransferForm((s) => ({ ...s, productId: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {trackedProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Origem</label>
                    <select
                      className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                      value={transferForm.fromDepositId}
                      onChange={(e) => setTransferForm((s) => ({ ...s, fromDepositId: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {depositOptions.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Destino</label>
                    <select
                      className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                      value={transferForm.toDepositId}
                      onChange={(e) => setTransferForm((s) => ({ ...s, toDepositId: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {depositOptions.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Quantidade</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                      value={transferForm.quantidade}
                      onChange={(e) => setTransferForm((s) => ({ ...s, quantidade: Number(e.target.value) }))}
                    />
                  </div>
                  <button
                    onClick={handleTransfer}
                    disabled={savingTransfer}
                    className="h-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-black uppercase tracking-wide shadow-blue-500/20 shadow-lg disabled:opacity-60"
                  >
                    {savingTransfer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                    Transferir
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-bdr bg-app p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-txt-muted">Ajuste</p>
                    <h4 className="text-sm font-black text-txt-main">Contagem e correção de estoque</h4>
                  </div>
                  <Plus className="w-5 h-5 text-txt-muted" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Produto</label>
                  <select
                    className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                    value={adjustForm.productId}
                    onChange={(e) => setAdjustForm((s) => ({ ...s, productId: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {trackedProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Depósito</label>
                    <select
                      className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                      value={adjustForm.depositId}
                      onChange={(e) => setAdjustForm((s) => ({ ...s, depositId: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {depositOptions.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wide text-txt-muted">Nova quantidade</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-lg border border-bdr bg-surface px-3 py-2 text-sm"
                      value={adjustForm.novaQuantidade}
                      onChange={(e) => setAdjustForm((s) => ({ ...s, novaQuantidade: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <button
                  onClick={handleAdjust}
                  disabled={savingAdjust}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white font-black uppercase tracking-wide px-3 py-2 shadow-lg shadow-green-500/20 disabled:opacity-60"
                >
                  {savingAdjust ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Ajustar estoque
                </button>
              </section>
            </div>

            <section className="rounded-2xl border border-bdr bg-app p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-txt-muted">Visão geral</p>
                  <h4 className="text-sm font-black text-txt-main">Quantidades por depósito</h4>
                </div>
              </div>
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {depositOptions.length === 0 && <p className="text-sm text-txt-muted">Cadastre ao menos um depósito para ver os estoques.</p>}
                {depositOptions.map((dep) => {
                  const depStock = stockMatrix[dep.id] || {};
                  const depProducts = trackedProducts.filter((p) => {
                    const productDep = getDepositId(p);
                    return !productDep || productDep === dep.id;
                  });
                  return (
                    <div key={dep.id} className="rounded-xl border border-bdr bg-surface p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: dep.cor || '#9CA3AF' }} />
                          <p className="text-sm font-black text-txt-main">{dep.nome}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-txt-muted">{depProducts.length} produtos</span>
                      </div>
                      {depProducts.length === 0 ? (
                        <p className="text-xs text-txt-muted">Nenhum produto vinculado.</p>
                      ) : (
                        <div className="divide-y divide-bdr">
                          {depProducts.map((p) => {
                            const qty = depStock[p.id] ?? 0;
                            return (
                              <div key={p.id} className="flex items-center justify-between py-2">
                                <div>
                                  <p className="text-sm font-bold text-txt-main">{p.nome}</p>
                                  <p className="text-[11px] text-txt-muted">Código: {p.codigo || '—'}</p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-lg font-black ${qty <= 0 ? 'text-red-500' : qty <= 5 ? 'text-amber-500' : 'text-green-500'}`}>{qty}</p>
                                  <p className="text-[10px] text-txt-muted uppercase">unidades</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};