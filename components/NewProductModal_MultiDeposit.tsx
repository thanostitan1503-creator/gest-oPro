import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { X, Plus, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Produto, StockMovementRule, TipoProduto, ProductPricing } from '../src/domain/types';
import { bulkUpsertPricing, getPricingByProduct, listExchangeRulesByProduct, getBalance } from '../src/domain/repositories';
import { generateId, db } from '../src/domain/db';

interface DepositPricing {
  depositoId: string;
  depositoNome: string;
  price: number;
  stock: number;
  minStock: number;
  returnProductId: string | null;
  
  // ⚠️ EXCHANGE: Preço e estoque do vasilhame vazio
  emptyPrice?: number;  // Preço de VENDA do vazio
  emptyStock?: number;  // Estoque inicial do vazio
}

interface MultiDepositProductPayload {
  product: Partial<Produto>;
  emptyProductName?: string;  // Nome do produto vazio (EXCHANGE)
  emptyProductCost?: number;  // Custo do produto vazio (EXCHANGE)
  pricingByDeposit: Array<{
    depositoId: string;
    price: number;        // Preço de venda do produto CHEIO
    stock: number;        // Estoque inicial do produto CHEIO
    minStock: number;
    returnProductId: string | null;
    emptyPrice?: number;  // Preço de venda do produto VAZIO (EXCHANGE)
    emptyStock?: number;  // Estoque inicial do produto VAZIO (EXCHANGE)
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deposits: Array<{ id: string; nome: string }>;
  products: Produto[];
  initial?: Partial<Produto>;
  onSave: (payload: Partial<Produto> | Array<Partial<Produto>> | MultiDepositProductPayload) => Promise<void> | void;
}

const NewProductModal: FC<Props> = ({ isOpen, onClose, deposits, products, initial, onSave }) => {
  const DELIVERY_FEE_GROUP = 'delivery_fee';
  const DELIVERY_FEE_NAME = 'Taxa de entrega';

  // Estados básicos
  const [nome, setNome] = useState<string>('');
  const [tipo, setTipo] = useState<TipoProduto>('GAS_CHEIO');
  const [itemKind, setItemKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [preco_custo, setPrecoCusto] = useState<string>('');
  const [ativo, setAtivo] = useState<boolean>(true);
  const [movementType, setMovementType] = useState<StockMovementRule>('SIMPLE');
  const [saving, setSaving] = useState(false);
  
  // EXCHANGE: Nome e custo do produto vazio
  const [emptyProductName, setEmptyProductName] = useState<string>('');
  const [emptyProductCost, setEmptyProductCost] = useState<string>('');

  // Multi-deposit state
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set());
  const [depositPricing, setDepositPricing] = useState<Map<string, DepositPricing>>(new Map());
  const [expandedDepositIds, setExpandedDepositIds] = useState<Set<string>>(new Set());

  const parseNum = (v: string) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const costValue = parseNum(preco_custo);

  const isServiceProduct = (p: Produto) => {
    const track = (p as any).track_stock ?? (p as any).trackStock;
    if (track === false) return true;
    if ((p as any).type === 'SERVICE') return true;
    const flag = (p as any).is_delivery_fee ?? (p as any).isDeliveryFee;
    return flag === true || String((p as any).product_group ?? (p as any).codigo ?? '').toLowerCase() === DELIVERY_FEE_GROUP;
  };

  const returnCandidates = useMemo(() => {
    const available = (products || []).filter((p) => !isServiceProduct(p));
    const withoutSelf = available.filter((p) => p.id !== initial?.id);
    const empties = withoutSelf.filter((p) => p.tipo === 'VASILHAME_VAZIO');
    return empties.length > 0 ? empties : withoutSelf;
  }, [products, initial]);

  // Carregar dados ao abrir modal (modo edição)
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return;

      // Resetar estados
      setNome(initial?.nome || '');
      setTipo((initial?.tipo as TipoProduto) || 'GAS_CHEIO');
      setItemKind(initial?.tipo === 'OUTROS' && (initial as any).type === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
      setPrecoCusto(initial?.preco_custo ? String(initial.preco_custo) : '');
      setAtivo(initial?.ativo ?? true);
      setMovementType((initial as any)?.movement_type || 'SIMPLE');
      setSelectedDepositIds(new Set());
      setDepositPricing(new Map());
      setExpandedDepositIds(new Set());
      setEmptyProductName('');
      setEmptyProductCost('');

      // Se for edição, carregar preços por depósito
      if (initial?.id) {
        try {
          const [existingPricing, exchangeRules] = await Promise.all([
            getPricingByProduct(initial.id),
            listExchangeRulesByProduct(initial.id),
          ]);
          const newSelected = new Set<string>();
          const newPricing = new Map<string, DepositPricing>();
          const newExpanded = new Set<string>();

          for (const pricing of existingPricing) {
            const deposit = deposits.find(d => d.id === pricing.depositoId);
            if (!deposit) continue;

            newSelected.add(pricing.depositoId);
            newExpanded.add(pricing.depositoId);

            const rule = exchangeRules.find(r => r.depositoId === pricing.depositoId);
            const returnId = rule?.returnProductId || (initial as any)?.return_product_id || null;

            // ✅ Buscar estoque do stock_balance (fonte da verdade)
            const stockBalance = await getBalance(pricing.depositoId, initial.id);
            
            newPricing.set(pricing.depositoId, {
              depositoId: pricing.depositoId,
              depositoNome: deposit.nome,
              price: pricing.price,
              stock: stockBalance?.quantidade_atual ?? 0,
              minStock: 0, // Estoque mínimo não está no stock_balance, será definido no save
              returnProductId: returnId,
            });
          }

          setSelectedDepositIds(newSelected);
          setDepositPricing(newPricing);
          setExpandedDepositIds(newExpanded);
        } catch (error) {
          console.error('Erro ao carregar preços por depósito:', error);
        }
      }
    };

    loadData();
  }, [isOpen, initial, deposits, products]);

  const handleItemKindChange = (next: 'PRODUCT' | 'SERVICE') => {
    setItemKind(next);
    if (next === 'SERVICE') {
      setTipo('OUTROS');
      setMovementType('SIMPLE');
      setSelectedDepositIds(new Set());
      setDepositPricing(new Map());
      setEmptyProductName('');
      setEmptyProductCost('');
    }
  };

  const handleMovementTypeChange = (newType: StockMovementRule) => {
    setMovementType(newType);
    if (newType !== 'EXCHANGE') {
      setEmptyProductName('');
      setEmptyProductCost('');
    }
  };

  const handleToggleDeposit = (depositId: string) => {
    const newSelected = new Set(selectedDepositIds);
    const newPricing = new Map(depositPricing);
    const newExpanded = new Set(expandedDepositIds);

    if (newSelected.has(depositId)) {
      // Desmarcar
      newSelected.delete(depositId);
      newPricing.delete(depositId);
      newExpanded.delete(depositId);
    } else {
      // Marcar
      const deposit = deposits.find(d => d.id === depositId);
      if (!deposit) return;

      newSelected.add(depositId);
      newExpanded.add(depositId);
      newPricing.set(depositId, {
        depositoId: depositId,
        depositoNome: deposit.nome,
        price: 0,
        stock: 0,
        minStock: 0,
        returnProductId: null,
      });
    }

    setSelectedDepositIds(newSelected);
    setDepositPricing(newPricing);
    setExpandedDepositIds(newExpanded);
  };

  const handleToggleExpand = (depositId: string) => {
    const newExpanded = new Set(expandedDepositIds);
    if (newExpanded.has(depositId)) {
      newExpanded.delete(depositId);
    } else {
      newExpanded.add(depositId);
    }
    setExpandedDepositIds(newExpanded);
  };

  const handleUpdateDepositPricing = (depositId: string, field: keyof DepositPricing, value: any) => {
    const newPricing = new Map(depositPricing);
    const current = newPricing.get(depositId);
    if (!current) return;

    newPricing.set(depositId, {
      ...current,
      [field]: value,
    });

    setDepositPricing(newPricing);
  };

  const performSave = async () => {
    const isService = itemKind === 'SERVICE';

    // Validações (mais flexíveis no auto-save)
    if (!nome || !nome.trim()) {
      return alert('Nome do produto é obrigatório');
    }

    if (!isService && selectedDepositIds.size === 0) {
      return alert('Selecione pelo menos um depósito para vender este produto');
    }

    if (!isService && costValue <= 0) {
      return alert('Informe o preço de custo');
    }

    // Validar preços por depósito
    if (!isService) {
      for (const depositId of selectedDepositIds) {
        const pricing = depositPricing.get(depositId);
        if (!pricing || pricing.price <= 0) {
          return alert(`Informe o preço de venda para o depósito ${pricing?.depositoNome || depositId}`);
        }
        if (pricing.price < costValue) {
          const confirm = window.confirm(
            `O preço de venda em ${pricing.depositoNome} (R$ ${pricing.price.toFixed(2)}) é menor que o custo (R$ ${costValue.toFixed(2)}). Deseja continuar?`
          );
          if (!confirm) return;
        }
      }
    }

    // Validar produto de retorno (EXCHANGE) - versão simplificada
    if (!isService && movementType === 'EXCHANGE') {
      if (!emptyProductName || !emptyProductName.trim()) {
        return alert('Informe o nome do produto vazio (vasilhame)');
      }
      const emptyCost = parseNum(emptyProductCost);
      if (emptyCost <= 0) {
        return alert('Informe o preço de COMPRA do vasilhame vazio');
      }
    }

    const nowIso = new Date().toISOString();
    const productId = initial?.id || generateId();

    if (isService) {
        // Serviços: fluxo antigo (simples)
        const servicePayload = {
          ...initial,
          id: productId,
          nome: nome.trim(),
          tipo: 'OUTROS',
          preco_custo: 0,
          preco_venda: 0,
          preco_padrao: 0,
          ativo,
          depositoId: null,
          current_stock: null,
          track_stock: false,
          type: 'SERVICE',
          is_delivery_fee: false,
          movement_type: 'SIMPLE',
          return_product_id: null,
          created_at: initial?.created_at || nowIso,
          updated_at: nowIso,
        } as Partial<Produto> & {
          track_stock?: boolean;
          type?: string | null;
        };

        await onSave(servicePayload);
      } else {
        // Produtos: fluxo multi-depósito
        const productPayload = {
          ...initial,
          id: productId,
          nome: nome.trim(),
          tipo: tipo,
          preco_custo: costValue,
          preco_venda: 0, // Será calculado pela média dos depósitos
          preco_padrao: 0,
          ativo,
          depositoId: null, // GLOBAL para multi-depot
          current_stock: null,
          min_stock: null,
          track_stock: true,
          type: null,
          is_delivery_fee: false,
          movement_type: movementType,
          return_product_id: null, // Será por depósito via pricingByDeposit
          product_group: (initial as any)?.product_group || null,
          codigo: (initial as any)?.codigo || '',
          created_at: initial?.created_at || nowIso,
          updated_at: nowIso,
        } as Partial<Produto> & {
          track_stock?: boolean;
          type?: string | null;
          min_stock?: number | null;
        };

        // Preparar dados de precificação por depósito
        const pricingByDeposit = Array.from(selectedDepositIds).map(depositId => {
          const pricing = depositPricing.get(depositId);
          if (!pricing) throw new Error(`Missing pricing for deposit ${depositId}`);

          return {
            depositoId: depositId,
            price: pricing.price,
            stock: pricing.stock,
            minStock: pricing.minStock,
            returnProductId: pricing.returnProductId,
            emptyPrice: pricing.emptyPrice, // ✅ Preço de VENDA do vasilhame vazio
            emptyStock: pricing.emptyStock, // ✅ Estoque inicial do vasilhame vazio
          };
        });

        // Enviar payload estruturado
        const multiDepositPayload: MultiDepositProductPayload = {
          product: productPayload,
          emptyProductName: emptyProductName.trim() || undefined,
          emptyProductCost: parseNum(emptyProductCost) || undefined,
          pricingByDeposit,
        };

        await onSave(multiDepositPayload);
      }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await performSave();
      // Só fecha modal no salvamento manual (botão Salvar)
      onClose();
    } catch (e) {
      console.error('Erro salvando produto:', e);
      alert('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const itemLabel = itemKind === 'SERVICE' ? 'Serviço' : 'Produto';
  const modalTitle = initial?.id ? `Editar ${itemLabel}` : `Novo ${itemLabel}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface w-full max-w-4xl rounded-[2rem] shadow-2xl border border-bdr overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-app px-8 py-6 border-b border-bdr flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-lg shadow-amber-500/30">
              <Plus className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-txt-main">{modalTitle}</h3>
              <p className="text-xs text-txt-muted font-bold uppercase">Precificação por depósito</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-txt-muted">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Tipo do Item */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white uppercase ml-1">Tipo do Item</label>
            <div className="grid grid-cols-2 gap-2 bg-app border border-bdr rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleItemKindChange('PRODUCT')}
                className={`py-3 rounded-lg text-xs font-black uppercase transition-colors ${
                  itemKind === 'PRODUCT' ? 'bg-amber-500 text-white' : 'text-txt-muted hover:text-txt-main'
                }`}
              >
                Produto
              </button>
              <button
                type="button"
                onClick={() => handleItemKindChange('SERVICE')}
                className={`py-3 rounded-lg text-xs font-black uppercase transition-colors ${
                  itemKind === 'SERVICE' ? 'bg-amber-500 text-white' : 'text-txt-muted hover:text-txt-main'
                }`}
              >
                Serviço
              </button>
            </div>
          </div>

          {/* PASSO 1: Nome do Produto */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white uppercase ml-1">1. Nome do {itemLabel}</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Gás P13 Supergasbras"
              className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-base font-bold outline-none"
              autoFocus
            />
          </div>

          {itemKind === 'PRODUCT' && (
            <>
              {/* PASSO 2: Tipo de Produto */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-white uppercase ml-1">2. Tipo de Produto</label>
                  <select
                    value={tipo}
                    onChange={e => setTipo(e.target.value as TipoProduto)}
                    className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none"
                  >
                    <option value="GAS_CHEIO">Gás (Cheio)</option>
                    <option value="AGUA">Água Mineral</option>
                    <option value="VASILHAME_VAZIO">Vasilhame/Casco</option>
                    <option value="OUTROS">Outros Produtos</option>
                  </select>
                </div>

                <div className="space-y-2 flex flex-col justify-end pb-1">
                  <div
                    className="flex items-center gap-3 p-3 bg-app border border-bdr rounded-xl cursor-pointer"
                    onClick={() => setAtivo(!ativo)}
                  >
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${ativo ? 'translate-x-6' : ''}`} />
                    </div>
                    <span className="text-sm font-black text-white uppercase">{ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              </div>

              {/* PASSO 3: Tipo de Movimentação */}
              <div className="space-y-2">
                <label className="text-xs font-black text-white uppercase ml-1">3. Tipo de Movimentação de Estoque</label>
                <select
                  value={movementType}
                  onChange={e => handleMovementTypeChange(e.target.value as StockMovementRule)}
                  className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none"
                >
                  <option value="SIMPLE">Venda simples (só sai do estoque)</option>
                  <option value="EXCHANGE">Troca (sai cheio, entra vazio)</option>
                  <option value="FULL">Venda completa (sem retorno)</option>
                </select>
              </div>

              {/* PASSO 3.1: Se EXCHANGE → Dados do Produto Vazio */}
              {movementType === 'EXCHANGE' && (
                <div className="space-y-4 border-2 border-dashed border-amber-400 rounded-xl p-6 bg-amber-50/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <p className="text-sm font-black text-amber-500 uppercase">Produto Vazio Vinculado (Criação Automática)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white uppercase ml-1">Nome do Vasilhame Vazio</label>
                    <input
                      value={emptyProductName}
                      onChange={e => setEmptyProductName(e.target.value)}
                      placeholder={`Ex: ${nome ? nome + ' Vazio' : 'Vasilhame Vazio'}`}
                      className="w-full bg-white text-slate-900 border-2 border-amber-300 rounded-xl p-4 text-base font-bold outline-none"
                    />
                    <p className="text-xs text-amber-400">Este produto será criado automaticamente junto com o produto cheio</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-white uppercase ml-1">Preço de COMPRA do Vasilhame (quando você compra vazio)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={emptyProductCost}
                        onChange={e => setEmptyProductCost(e.target.value)}
                        placeholder="70.00"
                        className="w-full bg-white border-2 border-amber-300 rounded-xl p-4 pl-14 text-lg font-black text-slate-900 outline-none"
                      />
                    </div>
                    <p className="text-xs text-amber-400">Preço de VENDA do vasilhame será definido por depósito nas próximas etapas</p>
                  </div>
                </div>
              )}

              {/* PASSO 4: Preço de Custo (GLOBAL) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-white uppercase ml-1">{movementType === 'EXCHANGE' ? '4' : '3'}. Preço de Custo (Compra) - Global</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={preco_custo}
                    onChange={e => setPrecoCusto(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border-2 border-amber-200 rounded-2xl p-4 pl-14 text-lg font-black text-slate-900 outline-none"
                  />
                </div>
                <p className="text-xs text-txt-muted">Este custo será usado para calcular a margem em cada depósito</p>
              </div>

              {/* PASSO 5: Seleção de Depósitos */}
              <div className="space-y-4 border-t border-bdr pt-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-white uppercase ml-1">{movementType === 'EXCHANGE' ? '5' : '4'}. Selecione os Depósitos</label>
                  <p className="text-xs text-txt-muted">Marque em quais depósitos este produto será vendido</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {deposits.map(deposit => {
                    const isSelected = selectedDepositIds.has(deposit.id);
                    const isExpanded = expandedDepositIds.has(deposit.id);
                    const pricing = depositPricing.get(deposit.id);
                    const marginValue = pricing && costValue > 0 ? ((pricing.price - costValue) / costValue) * 100 : 0;
                    const marginLabel = `${marginValue.toFixed(1)}%`;
                    const marginTone = !pricing || costValue === 0 ? 'text-txt-muted' : marginValue < 0 ? 'text-red-600' : 'text-emerald-600';

                    return (
                      <div key={deposit.id} className="bg-app border border-bdr rounded-xl overflow-hidden">
                        {/* Checkbox + Nome do Depósito */}
                        <div className="flex items-center gap-3 p-4">
                          <button
                            type="button"
                            onClick={() => handleToggleDeposit(deposit.id)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-bdr hover:border-emerald-400'
                            }`}
                          >
                            {isSelected && <Check className="w-4 h-4" />}
                          </button>
                          <span className="flex-1 text-sm font-bold text-txt-main">{deposit.nome}</span>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(deposit.id)}
                              className="p-2 hover:bg-black/5 rounded-lg text-txt-muted"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>

                        {/* Campos Expandidos */}
                        {isSelected && isExpanded && pricing && (
                          <div className="border-t border-bdr p-4 space-y-4 bg-surface/50">
                            {/* Preço de Venda */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white uppercase">Preço de Venda</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={pricing.price || ''}
                                  onChange={e => handleUpdateDepositPricing(deposit.id, 'price', parseNum(e.target.value))}
                                  placeholder="0.00"
                                  className="w-full bg-white border-2 border-emerald-200 rounded-xl p-3 pl-14 text-base font-black text-emerald-700 outline-none"
                                />
                              </div>
                            </div>

                            {/* Margem de Lucro */}
                            {costValue > 0 && (
                              <div className="bg-app border border-bdr rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] font-black text-white uppercase">Margem de Lucro</p>
                                    <p className={`text-xl font-black ${marginTone}`}>{marginLabel}</p>
                                  </div>
                                  <div className="text-[10px] text-txt-muted text-right">
                                    Custo: R$ {costValue.toFixed(2)}<br />
                                    Venda: R$ {(pricing.price || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Estoque Inicial */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-white uppercase">Estoque Inicial</label>
                                <input
                                  type="number"
                                  step="1"
                                  value={pricing.stock || ''}
                                  onChange={e => handleUpdateDepositPricing(deposit.id, 'stock', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-3 text-sm font-bold outline-none"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-white uppercase">Estoque Mínimo</label>
                                <input
                                  type="number"
                                  step="1"
                                  value={pricing.minStock || ''}
                                  onChange={e => handleUpdateDepositPricing(deposit.id, 'minStock', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-3 text-sm font-bold outline-none"
                                />
                              </div>
                            </div>

                            {/* Preço e Estoque do Vasilhame Vazio (apenas se EXCHANGE) */}
                            {movementType === 'EXCHANGE' && (
                              <div className="space-y-4 border-t border-dashed border-amber-300 pt-4">
                                <label className="text-[10px] font-black text-amber-500 uppercase">Vasilhame Vazio neste Depósito</label>
                                
                                {/* Preço de VENDA do Vazio */}
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-amber-600 uppercase">Preço de Venda</label>
                                  <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={(pricing as any).emptyPrice || ''}
                                      onChange={e => handleUpdateDepositPricing(deposit.id, 'emptyPrice' as any, parseNum(e.target.value))}
                                      placeholder="80.00"
                                      className="w-full bg-white border-2 border-amber-300 rounded-xl p-3 pl-14 text-base font-black text-amber-700 outline-none"
                                    />
                                  </div>
                                  <p className="text-xs text-amber-400">Preço pelo qual você vende o vasilhame vazio</p>
                                </div>

                                {/* Estoque Inicial do Vazio */}
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-amber-600 uppercase">Estoque Inicial de Vazios</label>
                                  <input
                                    type="number"
                                    step="1"
                                    value={(pricing as any).emptyStock || ''}
                                    onChange={e => handleUpdateDepositPricing(deposit.id, 'emptyStock' as any, parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full bg-white border-2 border-amber-300 rounded-xl p-3 text-base font-black text-amber-700 outline-none"
                                  />
                                  <p className="text-xs text-amber-400">Quantos vasilhames vazios você já tem em estoque</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-bdr bg-app flex justify-end gap-4 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 font-bold text-txt-muted hover:bg-bdr rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-xl shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : `Salvar ${itemLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProductModal;
