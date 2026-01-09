import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { X, Plus, Package, Calculator, ChevronDown, Box } from 'lucide-react';
import { Produto, StockMovementRule, TipoProduto } from '@/domain/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deposits: Array<{ id: string; nome: string }>;
  products: Produto[];
  defaultDepositId?: string;
  initial?: Partial<Produto>;
  onSave: (payload: Partial<Produto> | Array<Partial<Produto>>) => Promise<void> | void;
}

const NewProductModal: FC<Props> = ({ isOpen, onClose, deposits, products, defaultDepositId, initial = {} as Partial<Produto>, onSave }) => {
  const DELIVERY_FEE_GROUP = 'delivery_fee';
  const DELIVERY_FEE_NAME = 'Taxa de entrega';
  const init = initial || ({} as Partial<Produto>);
  const resolveItemKind = (src: Partial<Produto>) => {
    const flag = (src as any).is_delivery_fee ?? (src as any).isDeliveryFee;
    const group = String((src as any).product_group ?? (src as any).codigo ?? '').toLowerCase();
    const name = String((src as any).nome ?? '').trim().toLowerCase();
    const type = (src as any).type ?? (src as any).item_type ?? null;
    const track = (src as any).track_stock ?? (src as any).trackStock;
    if (flag === true || group === DELIVERY_FEE_GROUP || name === DELIVERY_FEE_NAME.toLowerCase()) return 'SERVICE';
    if (type === 'SERVICE' || track === false) return 'SERVICE';
    return 'PRODUCT';
  };
  const normalizeMovementType = (src: Partial<Produto>): StockMovementRule => {
    const raw = String((src as any).movement_type ?? (src as any).movementType ?? '').toUpperCase();
    if (raw === 'EXCHANGE' || raw === 'FULL' || raw === 'SIMPLE') return raw as StockMovementRule;
    const kind = resolveItemKind(src);
    if (kind === 'SERVICE') return 'SIMPLE';
    const tracksEmpties = Boolean((src as any).tracks_empties ?? (src as any).tracksEmpties ?? (src as any).tipo === 'GAS_CHEIO');
    return tracksEmpties ? 'EXCHANGE' : 'SIMPLE';
  };
  const [nome, setNome] = useState<string>(init.nome || '');
  const [tipo, setTipo] = useState<TipoProduto>((init.tipo as TipoProduto) || 'GAS_CHEIO');
  const [itemKind, setItemKind] = useState<'PRODUCT' | 'SERVICE'>(resolveItemKind(init));
  const [currentStock, setCurrentStock] = useState<string>(
    init.current_stock !== null && init.current_stock !== undefined ? String(init.current_stock) : ''
  );
  const [minStock, setMinStock] = useState<string>(
    (init as any).min_stock !== null && (init as any).min_stock !== undefined ? String((init as any).min_stock) : ''
  );
  const [preco_custo, setPrecoCusto] = useState<string>(init.preco_custo ? String(init.preco_custo) : '');
  const [preco_venda, setPrecoVenda] = useState<string>(init.preco_padrao ? String(init.preco_padrao) : '');
  const [ativo, setAtivo] = useState<boolean>(init.ativo ?? true);
  const [selectedDepositId, setSelectedDepositId] = useState<string>(defaultDepositId || (init.depositoId || init.deposit_id || '') as string);
  const [movementType, setMovementType] = useState<StockMovementRule>(normalizeMovementType(init));
  const [returnProductId, setReturnProductId] = useState<string>(
    String((init as any).return_product_id ?? (init as any).returnProductId ?? '')
  );
  const [saving, setSaving] = useState(false);
  // --- NEW: Controle de Criação do Vasilhame ---
  const [returnProductMode, setReturnProductMode] = useState<'existing' | 'create_new'>('existing');
  const [returnProductName, setReturnProductName] = useState<string>('');
  const [returnProductPrice, setReturnProductPrice] = useState<string>('');
  const [returnProductStock, setReturnProductStock] = useState<string>('');
  const [returnProductMinStock, setReturnProductMinStock] = useState<string>('');
  const deliveryFlag =
    (init as any).is_delivery_fee === true ||
    (init as any).isDeliveryFee === true;
  const isDeliveryFee =
    itemKind === 'SERVICE' &&
    (deliveryFlag ||
      String((init as any).product_group ?? (init as any).codigo ?? '').toLowerCase() === DELIVERY_FEE_GROUP ||
      String(nome || '').trim().toLowerCase() === DELIVERY_FEE_NAME.toLowerCase());

  useEffect(() => {
    if (isOpen) {
      const src = initial || ({} as Partial<Produto>);
      setNome(src.nome || '');
      setTipo((src.tipo as TipoProduto) || 'GAS_CHEIO');
      setItemKind(resolveItemKind(src));
      setCurrentStock(src.current_stock !== null && src.current_stock !== undefined ? String(src.current_stock) : '');
      setMinStock(
        (src as any).min_stock !== null && (src as any).min_stock !== undefined ? String((src as any).min_stock) : ''
      );
      setPrecoCusto(src.preco_custo ? String(src.preco_custo) : '');
      setPrecoVenda(src.preco_padrao ? String(src.preco_padrao) : '');
      setAtivo(src.ativo ?? true);
      setSelectedDepositId(defaultDepositId || (src.depositoId || src.deposit_id || '') as string);
      setMovementType(normalizeMovementType({ ...src, tipo: (src.tipo as TipoProduto) || 'GAS_CHEIO' }));
      setReturnProductId(String((src as any).return_product_id ?? (src as any).returnProductId ?? ''));
      // Reset return product fields
      setReturnProductMode('existing');
      setReturnProductName('');
      setReturnProductPrice('');
      setReturnProductStock('');
      setReturnProductMinStock('');
    }
  }, [isOpen, initial, defaultDepositId]);

  const parseNum = (v: string) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const costValue = parseNum(preco_custo);
  const saleValue = parseNum(preco_venda);
  const hasCost = costValue > 0;
  const marginValue = hasCost ? ((saleValue - costValue) / costValue) * 100 : 0;
  const marginLabel = `${marginValue.toFixed(1)}%`;
  const marginTone = !hasCost ? 'text-txt-muted' : marginValue < 0 ? 'text-red-600' : 'text-emerald-600';
  const isServiceProduct = (p: Produto) => {
    const track = (p as any).track_stock ?? (p as any).trackStock;
    if (track === false) return true;
    if ((p as any).type === 'SERVICE') return true;
    const flag = (p as any).is_delivery_fee ?? (p as any).isDeliveryFee;
    return flag === true || String((p as any).product_group ?? (p as any).codigo ?? '').toLowerCase() === DELIVERY_FEE_GROUP;
  };
  const returnCandidates = useMemo(() => {
    const available = (products || []).filter((p) => !isServiceProduct(p));
    const withoutSelf = available.filter((p) => p.id !== (init as any).id);
    const empties = withoutSelf.filter((p) => p.tipo === 'VASILHAME_VAZIO');
    return empties.length > 0 ? empties : withoutSelf;
  }, [products, init]);

  const handleItemKindChange = (next: 'PRODUCT' | 'SERVICE') => {
    setItemKind(next);
    if (next === 'SERVICE') {
      setTipo('OUTROS');
      setMovementType('SIMPLE');
      setReturnProductId('');
    }
  };

  const handleSave = async () => {
    const isService = itemKind === 'SERVICE';
    if (!nome || !nome.trim()) return alert('Nome do produto e obrigatorio');
    if (!isService && !selectedDepositId) return alert('Selecione o deposito do produto antes de salvar');
    
    // Validação para modo EXCHANGE
    if (!isService && movementType === 'EXCHANGE') {
      if (returnProductMode === 'existing' && !returnProductId) {
        return alert('Selecione o produto de retorno (casco/vasilhame vazio).');
      }
      if (returnProductMode === 'create_new') {
        if (!returnProductName || !returnProductName.trim()) {
          return alert('Informe o nome do vasilhame/casco.');
        }
        const returnPrice = parseNum(returnProductPrice);
        if (returnPrice <= 0) {
          return alert('Informe o preço de venda do vasilhame/casco.');
        }
      }
    }

    try {
      setSaving(true);

      // ROTA A: CRIAÇÃO CONJUNTA (NOVA)
      // Só cria AMBOS (casco + produto) se NÃO for vasilhame vazio
      if (!isService && movementType === 'EXCHANGE' && returnProductMode === 'create_new' && tipo !== 'VASILHAME_VAZIO') {
        const cascoPayload: Partial<Produto> = {
          nome: returnProductName.trim(),
          tipo: 'VASILHAME_VAZIO',
          preco_venda: parseNum(returnProductPrice),
          preco_padrao: parseNum(returnProductPrice),
          preco_custo: 0,
          current_stock: parseNum(returnProductStock),
          min_stock: parseNum(returnProductMinStock),
          ativo: true,
          deposit_id: selectedDepositId,
          movement_type: 'SIMPLE',
          return_product_id: null,
          track_stock: true,
          type: null,
          is_delivery_fee: false,
          product_group: null,
          codigo: null,
        };

        const mainPayload: Partial<Produto> & {
          track_stock?: boolean;
          type?: string | null;
          min_stock?: number | null;
        } = {
          ...JSON.parse(JSON.stringify(initial)),
          nome: isDeliveryFee ? DELIVERY_FEE_NAME : nome.trim(),
          tipo: isService ? 'OUTROS' : tipo,
          preco_custo: isService ? 0 : parseNum(preco_custo),
          preco_venda: isDeliveryFee ? 0 : parseNum(preco_venda),
          preco_padrao: isDeliveryFee ? 0 : parseNum(preco_venda),
          ativo,
          deposit_id: isService ? null : selectedDepositId,
          current_stock: isService ? null : parseNum(currentStock),
          min_stock: isService ? null : parseNum(minStock),
          track_stock: !isService,
          type: isService ? 'SERVICE' : null,
          is_delivery_fee: isDeliveryFee,
          movement_type: isService ? 'SIMPLE' : movementType,
          return_product_id: '__TEMP_NEW_RETURN_PRODUCT__', // Marcador: será substituído no backend
          product_group: isDeliveryFee ? DELIVERY_FEE_GROUP : (initial as any).product_group,
          codigo: isDeliveryFee ? DELIVERY_FEE_GROUP : (initial as any).codigo,
        };

        const payloads: Array<Partial<Produto>> = [cascoPayload, mainPayload];
        await onSave(payloads);
        onClose();
        return; // ⚠️ CRÍTICO: Mata a execução aqui! Evita fallthrough!
      }

      // ROTA B: CRIAÇÃO PADRÃO (ANTIGA)
      // Este bloco SÓ executa se não entrou no if acima
      const payload: Partial<Produto> & {
        track_stock?: boolean;
        type?: string | null;
        min_stock?: number | null;
      } = {
        ...JSON.parse(JSON.stringify(initial)),
        nome: isDeliveryFee ? DELIVERY_FEE_NAME : nome.trim(),
        tipo: isService ? 'OUTROS' : tipo,
        preco_custo: isService ? 0 : parseNum(preco_custo),
        preco_venda: isDeliveryFee ? 0 : parseNum(preco_venda),
        preco_padrao: isDeliveryFee ? 0 : parseNum(preco_venda),
        ativo,
        deposit_id: isService ? null : selectedDepositId,
        current_stock: isService ? null : parseNum(currentStock),
        min_stock: isService ? null : parseNum(minStock),
        track_stock: !isService,
        type: isService ? 'SERVICE' : null,
        is_delivery_fee: isDeliveryFee,
        movement_type: isService ? 'SIMPLE' : movementType,
        return_product_id: !isService && movementType === 'EXCHANGE' ? returnProductId || null : null,
        product_group: isDeliveryFee ? DELIVERY_FEE_GROUP : (initial as any).product_group,
        codigo: isDeliveryFee ? DELIVERY_FEE_GROUP : (initial as any).codigo,
      };

      await onSave(payload);
      onClose();
    } catch (e) {
      console.error('Erro salvando produto via modal', e);
      alert('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const itemLabel = itemKind === 'SERVICE' ? 'Servico' : 'Produto';
  const modalTitle = initial.id ? `Editar ${itemLabel}` : `Novo ${itemLabel}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface w-full max-w-2xl rounded-[2rem] shadow-2xl border border-bdr overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-app px-8 py-6 border-b border-bdr flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-lg shadow-amber-500/30">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-txt-main">{modalTitle}</h3>
              <p className="text-xs text-txt-muted font-bold uppercase">Preencha os dados e a precificação</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-txt-muted"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-2">
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
                  Servico
                </button>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-black text-white uppercase ml-1">Nome do {itemLabel}</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Gas P13 Supergasbras" className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-base font-bold outline-none" autoFocus />
            </div>

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2">
                <label className="text-xs font-black text-white uppercase ml-1">Tipo de Produto</label>
                <div className="relative">
                  <select value={tipo} onChange={e => setTipo(e.target.value as TipoProduto)} className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none">
                    <option value="GAS_CHEIO">Gas (Cheio)</option>
                    <option value="AGUA">Agua Mineral</option>
                    <option value="VASILHAME_VAZIO">Vasilhame/Casco</option>
                    <option value="OUTROS">Outros Produtos</option>
                  </select>
                </div>
              </div>
            )}

            <div className={`space-y-2 flex flex-col justify-end pb-1 ${itemKind === 'SERVICE' ? 'md:col-span-2' : ''}`}>
              <div className="flex items-center gap-3 p-3 bg-app border border-bdr rounded-xl cursor-pointer" onClick={() => setAtivo(!ativo)}>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${ativo ? 'translate-x-6' : ''}`} />
                </div>
                <span className="text-sm font-black text-white uppercase">{ativo ? `${itemLabel} Ativo` : `${itemLabel} Inativo`}</span>
              </div>
            </div>

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white uppercase ml-1">Estoque Atual</label>
                <input
                  type="number"
                  step="1"
                  value={currentStock}
                  onChange={e => setCurrentStock(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none"
                />
              </div>
            )}

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white uppercase ml-1">Estoque Minimo</label>
                <input
                  type="number"
                  step="1"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none"
                />
              </div>
            )}

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-[10px] font-black text-white uppercase ml-1">Preco de Custo (Compra)</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                  <input type="number" step="0.01" value={preco_custo} onChange={e => setPrecoCusto(e.target.value)} placeholder="0.00" className="w-full bg-white border-2 rounded-2xl p-4 pl-14 text-lg font-black text-slate-900 outline-none" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-1 text-[10px] font-black text-white uppercase ml-1">Preco de Venda (Final)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={isDeliveryFee ? '0' : preco_venda}
                  onChange={e => setPrecoVenda(e.target.value)}
                  placeholder="0.00"
                  disabled={isDeliveryFee}
                  className={`w-full bg-white border-2 rounded-2xl p-4 pl-14 text-2xl font-black text-emerald-700 outline-none ${
                    isDeliveryFee ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              {isDeliveryFee && (
                <div className="text-[11px] text-txt-muted">
                  A Taxa de entrega usa precificacao por zona no Painel &gt; Taxas de Entrega.
                </div>
              )}
            </div>

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2 md:col-span-2">
                <div className="bg-app border border-bdr rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black text-white uppercase">Margem de lucro (Markup)</p>
                      <p className={`text-2xl font-black ${marginTone}`}>{marginLabel}</p>
                    </div>
                    <div className="text-[11px] text-txt-muted text-right">
                      {hasCost
                        ? `Custo: R$ ${costValue.toFixed(2)} | Venda: R$ ${saleValue.toFixed(2)}`
                        : 'Informe o preco de custo para calcular a margem.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black text-white uppercase ml-1">Tipo de Movimentacao de Estoque</label>
                <select
                  value={movementType}
                  onChange={(e) => {
                    const next = e.target.value as StockMovementRule;
                    setMovementType(next);
                    if (next !== 'EXCHANGE') {
                      setReturnProductId('');
                    }
                  }}
                  className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none"
                >
                  <option value="SIMPLE">Venda simples (so sai do estoque)</option>
                  <option value="EXCHANGE">Troca (sai cheio, entra vazio)</option>
                  <option value="FULL">Venda completa (sem retorno)</option>
                </select>
                <div className="text-[11px] text-txt-muted">
                  Venda simples: baixa apenas o item vendido. Troca: baixa o cheio e adiciona o vasilhame vazio. Venda completa: baixa o cheio, sem retorno.
                </div>
              </div>
            )}

            {itemKind === 'PRODUCT' && movementType === 'EXCHANGE' && (
              <div className="space-y-4 md:col-span-2 border-t border-bdr pt-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-white uppercase ml-1">Vasilhame/Casco de Retorno</label>
                  <p className="text-[11px] text-txt-muted">
                    Escolha se deseja vincular a um casco existente ou cadastrar um novo agora mesmo.
                  </p>
                </div>

                {/* Toggle: Existing vs Create New */}
                <div className="grid grid-cols-2 gap-2 bg-app border border-bdr rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnProductMode('existing');
                      setReturnProductId('');
                    }}
                    className={`py-3 rounded-lg text-xs font-black uppercase transition-colors ${
                      returnProductMode === 'existing' ? 'bg-blue-500 text-white' : 'text-txt-muted hover:text-txt-main'
                    }`}
                  >
                    Usar Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnProductMode('create_new')}
                    className={`py-3 rounded-lg text-xs font-black uppercase transition-colors ${
                      returnProductMode === 'create_new' ? 'bg-green-500 text-white' : 'text-txt-muted hover:text-txt-main'
                    }`}
                  >
                    Criar Novo
                  </button>
                </div>

                {/* Existing Product Select */}
                {returnProductMode === 'existing' && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white uppercase ml-1">Selecione o Vasilhame</label>
                    <select
                      value={returnProductId}
                      onChange={(e) => setReturnProductId(e.target.value)}
                      className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none"
                      disabled={returnCandidates.length === 0}
                    >
                      <option value="">
                        {returnCandidates.length === 0 ? 'Nenhum casco cadastrado' : 'Selecione o vasilhame vazio...'}
                      </option>
                      {returnCandidates.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-txt-muted">
                      Exemplo: Casco P13 Vazio, Galao Vazio 20L.
                    </div>
                  </div>
                )}

                {/* Create New Product Form */}
                {returnProductMode === 'create_new' && (
                  <div className="space-y-4 bg-app border border-green-400/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="w-4 h-4 text-green-500" />
                      <p className="text-xs font-black text-green-400 uppercase">Dados do Novo Vasilhame</p>
                    </div>

                    {/* Nome do Vasilhame */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white uppercase ml-1">Nome do Vasilhame/Casco</label>
                      <input
                        type="text"
                        value={returnProductName}
                        onChange={(e) => setReturnProductName(e.target.value)}
                        placeholder={`Ex: Casco ${tipo} Vazio`}
                        className="w-full bg-white text-slate-900 border-2 border-green-300 rounded-xl p-4 text-sm font-bold outline-none"
                      />
                      <div className="text-[10px] text-txt-muted">
                        Sugestão: Adicione "Vazio" ou "Casco" ao nome para diferenciador.
                      </div>
                    </div>

                    {/* Preço de Venda do Casco */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white uppercase ml-1">Preço de Venda do Casco</label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black z-10 text-sm">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={returnProductPrice}
                          onChange={(e) => setReturnProductPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border-2 border-green-300 rounded-xl p-4 pl-14 text-base font-black text-slate-900 outline-none"
                        />
                      </div>
                      <div className="text-[10px] text-txt-muted">
                        O depósito vende o casco/vasilhame vazio. Informe o preço de venda.
                      </div>
                    </div>

                    {/* Estoque Inicial */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white uppercase ml-1">Estoque Inicial do Casco</label>
                      <input
                        type="number"
                        step="1"
                        value={returnProductStock}
                        onChange={(e) => setReturnProductStock(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white text-slate-900 border-2 border-green-300 rounded-xl p-4 text-sm font-bold outline-none"
                      />
                      <div className="text-[10px] text-txt-muted">
                        Quantos vasilhames vazios você já tem no pátio?
                      </div>
                    </div>

                    {/* Estoque Mínimo */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white uppercase ml-1">Estoque Mínimo do Casco</label>
                      <input
                        type="number"
                        step="1"
                        value={returnProductMinStock}
                        onChange={(e) => setReturnProductMinStock(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white text-slate-900 border-2 border-green-300 rounded-xl p-4 text-sm font-bold outline-none"
                      />
                      <div className="text-[10px] text-txt-muted">
                        Quantidade mínima para alertar sobre reposição.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {itemKind === 'PRODUCT' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black text-white uppercase ml-1">Deposito Vinculado</label>
                <select value={selectedDepositId} onChange={e => setSelectedDepositId(e.target.value)} className="w-full bg-white text-slate-900 border-2 border-amber-200 rounded-xl p-4 text-sm font-bold outline-none">
                  <option value="">Selecione o deposito...</option>
                  {deposits.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
            )}

          </div>
</div>

        <div className="p-6 border-t border-bdr bg-app flex justify-end gap-4 shrink-0">
          <button onClick={onClose} className="px-6 py-3 font-bold text-txt-muted hover:bg-bdr rounded-xl">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-xl shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-2">Salvar {itemLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default NewProductModal;



