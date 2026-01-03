
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  X, 
  ArrowRightLeft, 
  ClipboardCheck, 
  Plus, 
  Minus, 
  HelpCircle,
  Truck,
  ArrowRight,
  Package,
  Trash2,
  FileText,
  AlertCircle,
  Save,
  RotateCcw,
  Cylinder,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Factory,
  Boxes
} from 'lucide-react';
import { listProducts, applyMovement, getStockMapForDeposit } from '../src/domain_old/repositories';
import { db } from '../domain/db';
import { Produto, SaldoEstoque, MovimentoEstoque } from '../domain/types';

interface InventoryCountModuleProps {
  onClose: () => void;
}

type TabType = 'transfer' | 'count' | 'supply' | 'bleed';

interface BleedItem {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  estoqueAtual: number;
  motivo: string;
  obs?: string;
}

export const InventoryCountModule: React.FC<InventoryCountModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('count');
  
  // -- Session / Context Mock --
  const [currentUser] = useState({ id: 'user-1', name: 'Administrador', role: 'ADMIN' });
  const isAdmin = currentUser.role === 'ADMIN';

  // -- Global State --
  const [currentDepositId, setCurrentDepositId] = useState('');
  const [products, setProducts] = useState<Produto[]>([]);
  const [stock, setStock] = useState<SaldoEstoque[]>([]);

  // -- State for Count (Contagem) --
  const [countInputs, setCountInputs] = useState<Record<string, number | ''>>({});

  // -- State for Bleed (Sangria) --
  const [bleedStaging, setBleedStaging] = useState<BleedItem[]>([]);
  const [bleedForm, setBleedForm] = useState({
    produtoId: '',
    quantidade: '',
    motivo: '',
    obs: ''
  });

  // -- State for Transfer (Transferência) --
  const [transferForm, setTransferForm] = useState({
    originId: '',
    destId: '',
    produtoId: '',
    quantidade: '',
    motivo: ''
  });

  // -- State for Supply (Suprimento) --
  const [supplyForm, setSupplyForm] = useState({
    depositId: '',
    produtoId: '',
    quantidade: '',
    origem: '', // Fornecedor ou Nota
    obs: ''
  });

  const deposits = useLiveQuery(() => db.deposits.toArray(), []);
  const depositOptions = useMemo(() => (deposits || []).filter((d) => d.ativo !== false), [deposits]);

  useEffect(() => {
    if (!depositOptions.length) return;
    const primaryId = depositOptions[0].id;
    setCurrentDepositId((prev) => prev || primaryId);
    setTransferForm((prev) => ({
      ...prev,
      originId: prev.originId || primaryId,
      destId: prev.destId || (depositOptions[1]?.id || primaryId),
    }));
    setSupplyForm((prev) => ({
      ...prev,
      depositId: prev.depositId || primaryId,
    }));
  }, [depositOptions]);

  const findDepositName = (id: string) => depositOptions.find((d) => d.id === id)?.nome || 'Selecionar depósito';
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

  // Load Data
  const refreshData = async () => {
    const loadedProducts = await listProducts();

    // Se estiver na aba de transferência, carregamos o estoque da origem selecionada no form
    const depositToLoad =
      activeTab === 'transfer'
        ? transferForm.originId
        : activeTab === 'supply'
          ? supplyForm.depositId
          : currentDepositId;

    if (!depositToLoad) {
      setStock([]);
      return;
    }

    const scopedProducts = loadedProducts.filter((p) => {
      if (isServiceProduct(p)) return false;
      const dep = resolveProductDepositId(p);
      return dep === null || dep === depositToLoad;
    });
    setProducts(scopedProducts);

    const stockMap = await getStockMapForDeposit(depositToLoad);
    const asArray: SaldoEstoque[] = scopedProducts.map((p) => {
      const hasMap = Object.prototype.hasOwnProperty.call(stockMap, p.id);
      const mappedQty = hasMap ? Number(stockMap[p.id]) : null;
      const currentStock =
        typeof (p as any).current_stock === 'number'
          ? (p as any).current_stock
          : typeof (p as any).quantidade_atual === 'number'
            ? (p as any).quantidade_atual
            : null;
      const qty = hasMap ? (Number.isFinite(mappedQty) ? mappedQty : 0) : (currentStock !== null ? Number(currentStock) : 0);
      return {
        depositoId: depositToLoad,
        produtoId: p.id,
        quantidade: qty,
      };
    });
    setStock(asArray);
  };

  useEffect(() => {
    void refreshData();
  }, [currentDepositId, activeTab, transferForm.originId, supplyForm.depositId]);

  // -- Helper: Get Current Stock for a Product --
  const getProductStock = (prodId: string) => {
    return stock.find(s => s.produtoId === prodId)?.quantidade || 0;
  };

  // ==================================================================================
  // TAB LOGIC: CONTAGEM (AJUSTE)
  // ==================================================================================
  
  const handleCountChange = (prodId: string, val: string) => {
    const num = parseInt(val);
    setCountInputs(prev => ({
      ...prev,
      [prodId]: isNaN(num) ? '' : Math.max(0, num)
    }));
  };

  const getDivergence = (prodId: string, currentQty: number) => {
    const inputVal = countInputs[prodId];
    if (inputVal === '' || inputVal === undefined) return null;
    return (inputVal as number) - currentQty;
  };

  const clearCount = () => {
    setCountInputs({});
  };

  const fillWithCurrent = () => {
    const newInputs: Record<string, number> = {};
    products.forEach(p => {
      newInputs[p.id] = getProductStock(p.id);
    });
    setCountInputs(newInputs);
  };

  const handleSaveCount = async () => {
    const adjustments: { prod: Produto, current: number, counted: number, diff: number }[] = [];

    products.forEach(p => {
      const current = getProductStock(p.id);
      const input = countInputs[p.id];
      
      // Only process items that have been counted and have a difference
      if (input !== '' && input !== undefined && input !== current) {
        adjustments.push({
          prod: p,
          current,
          counted: input as number,
          diff: (input as number) - current
        });
      }
    });

    if (adjustments.length === 0) {
      alert("Nenhuma divergência encontrada ou nenhum item contado para registrar.");
      return;
    }

    if (!confirm(`Confirma o ajuste de estoque para ${adjustments.length} itens com divergência?`)) return;

    for (const adj of adjustments) {
      // Ledger: o movimento é a fonte da verdade
      const movement: MovimentoEstoque = {
        id: crypto.randomUUID(),
        dataHora: new Date().toISOString(),
        depositoId: currentDepositId,
        produtoId: adj.prod.id,
        produtoNome: adj.prod.nome,
        tipo: 'AJUSTE_CONTAGEM',
        quantidade: Math.abs(adj.diff),
        origem: 'TELA_CONTAGEM_MOVIMENTACAO',
        usuarioId: currentUser.id,
        usuarioNome: currentUser.name,
        motivo: `Ajuste de Inventário: Era ${adj.current}, Contado ${adj.counted}`,
        meta: {
          beforeQty: adj.current,
          afterQty: adj.counted,
          divergence: adj.diff,
        },
      };
      await applyMovement(movement);
    }

    alert("Contagem registrada com sucesso!");
    clearCount();
    await refreshData();
  };

  // ==================================================================================
  // TAB LOGIC: SANGRIA (SAÍDA)
  // ==================================================================================

  const handleAddBleedItem = () => {
    if (!bleedForm.produtoId) return alert("Selecione um produto.");
    if (!bleedForm.motivo) return alert("Informe o motivo da saída.");
    
    const qty = parseInt(bleedForm.quantidade);
    if (isNaN(qty) || qty <= 0) return alert("Quantidade deve ser maior que zero.");

    const currentQty = getProductStock(bleedForm.produtoId);
    if (qty > currentQty) return alert(`Quantidade indisponível. Estoque atual: ${currentQty}`);

    const prod = products.find(p => p.id === bleedForm.produtoId);
    if (!prod) return;

    const newItem: BleedItem = {
      id: crypto.randomUUID(),
      produtoId: prod.id,
      produtoNome: prod.nome,
      quantidade: qty,
      estoqueAtual: currentQty,
      motivo: bleedForm.motivo,
      obs: bleedForm.obs
    };

    setBleedStaging([...bleedStaging, newItem]);
    setBleedForm({ ...bleedForm, produtoId: '', quantidade: '', obs: '' });
  };

  const handleRemoveBleedItem = (id: string) => {
    setBleedStaging(bleedStaging.filter(i => i.id !== id));
  };

  const handleSaveBleed = async () => {
    if (bleedStaging.length === 0) return alert("Adicione itens à lista antes de salvar.");

    if (!confirm(`Confirma a saída (sangria) de ${bleedStaging.length} itens do estoque?`)) return;

    for (const item of bleedStaging) {
      const movement: MovimentoEstoque = {
        id: crypto.randomUUID(),
        dataHora: new Date().toISOString(),
        depositoId: currentDepositId,
        produtoId: item.produtoId,
        produtoNome: item.produtoNome,
        tipo: 'SANGRIA_SAIDA',
        quantidade: item.quantidade,
        origem: 'TELA_CONTAGEM_MOVIMENTACAO',
        usuarioId: currentUser.id,
        usuarioNome: currentUser.name,
        motivo: item.motivo + (item.obs ? ` (${item.obs})` : ''),
        meta: {
          beforeQty: item.estoqueAtual,
          afterQty: item.estoqueAtual - item.quantidade,
          requestedQty: item.quantidade,
        },
      };
      await applyMovement(movement);
    }

    alert("Sangria registrada com sucesso!");
    setBleedStaging([]);
    await refreshData();
  };

  // ==================================================================================
  // TAB LOGIC: TRANSFERÊNCIA
  // ==================================================================================

  const handleTransfer = async () => {
    if (transferForm.originId === transferForm.destId) return alert("Origem e destino devem ser diferentes.");
    if (!transferForm.produtoId) return alert("Selecione um produto.");
    if (!transferForm.quantidade) return alert("Informe a quantidade.");

    const qty = parseInt(transferForm.quantidade);
    const currentQty = getProductStock(transferForm.produtoId);
    
    if (qty > currentQty) return alert(`Saldo insuficiente na origem. Disponível: ${currentQty}`);

    const prod = products.find(p => p.id === transferForm.produtoId);
    if (!prod) return;

    if (!confirm(`Confirmar transferência de ${qty} ${prod.nome}?\nDe: ${transferForm.originId}\nPara: ${transferForm.destId}`)) return;

    const now = new Date().toISOString();

    // 1. Saída da Origem
    await applyMovement({
      id: crypto.randomUUID(),
      dataHora: now,
      depositoId: transferForm.originId,
      produtoId: prod.id,
      produtoNome: prod.nome,
      tipo: 'SAIDA',
      quantidade: qty,
      origem: 'TELA_CONTAGEM_MOVIMENTACAO',
      usuarioId: currentUser.id,
      usuarioNome: currentUser.name,
      motivo: `Transferência para ${transferForm.destId}`,
      meta: { transferTarget: transferForm.destId },
    });

    // 2. Entrada no Destino
    await applyMovement({
      id: crypto.randomUUID(),
      dataHora: now,
      depositoId: transferForm.destId,
      produtoId: prod.id,
      produtoNome: prod.nome,
      tipo: 'ENTRADA',
      quantidade: qty,
      origem: 'TELA_CONTAGEM_MOVIMENTACAO',
      usuarioId: currentUser.id,
      usuarioNome: currentUser.name,
      motivo: `Transferência recebida de ${transferForm.originId}`,
      meta: { transferSource: transferForm.originId },
    });

    alert("Transferência realizada com sucesso!");
    setTransferForm({ ...transferForm, quantidade: '', produtoId: '' });
    await refreshData();
  };

  // ==================================================================================
  // TAB LOGIC: SUPRIMENTO (ENTRADA)
  // ==================================================================================

  const handleSupply = async () => {
    if (!supplyForm.produtoId) return alert("Selecione um produto.");
    if (!supplyForm.quantidade) return alert("Informe a quantidade.");
    
    const qty = parseInt(supplyForm.quantidade);
    if (isNaN(qty) || qty <= 0) return alert("Quantidade inválida.");

    const prod = products.find(p => p.id === supplyForm.produtoId);
    if (!prod) return;

    if (!confirm(`Confirmar entrada de ${qty} ${prod.nome} em ${supplyForm.depositId}?`)) return;

    // Ledger: entrada de estoque
    await applyMovement({
      id: crypto.randomUUID(),
      dataHora: new Date().toISOString(),
      depositoId: supplyForm.depositId,
      produtoId: prod.id,
      produtoNome: prod.nome,
      tipo: 'SUPRIMENTO_ENTRADA',
      quantidade: qty,
      origem: 'TELA_CONTAGEM_MOVIMENTACAO',
      usuarioId: currentUser.id,
      usuarioNome: currentUser.name,
      motivo: `Entrada de Suprimento: ${supplyForm.origem || 'Não informado'}`,
      meta: { obs: supplyForm.obs }
    });

    alert("Entrada de suprimento registrada!");
    setSupplyForm({ ...supplyForm, quantidade: '', produtoId: '', origem: '', obs: '' });
    await refreshData();
  };

  // Reusable Tooltip Component
  const Tooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2 align-middle">
      <HelpCircle className="w-4 h-4 text-txt-muted cursor-help hover:text-primary transition-colors" />
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-surface border border-bdr text-txt-main text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none text-center">
        {text}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <ClipboardCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-txt-main">Contagem e Movimentação</h2>
            <p className="text-sm text-txt-muted">Gestão de estoque físico por depósito</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-app rounded-full text-txt-muted transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-surface border-b border-bdr px-6 transition-colors">
        <div className="flex gap-8 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('count')}
            className={`pb-4 pt-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'count' ? 'border-primary text-primary' : 'border-transparent text-txt-muted hover:text-txt-main'}`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Contagem (Ajuste)
            <Tooltip text="Conferência física do estoque para corrigir divergências com o sistema." />
          </button>

          <button 
            onClick={() => setActiveTab('bleed')}
            className={`pb-4 pt-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'bleed' ? 'border-primary text-primary' : 'border-transparent text-txt-muted hover:text-txt-main'}`}
          >
            <Minus className="w-4 h-4" />
            Sangria (Saída)
            <Tooltip text="Remover estoque manualmente (ex: perda, roubo, doação, consumo interno)." />
          </button>

          <button 
            onClick={() => setActiveTab('transfer')}
            className={`pb-4 pt-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'transfer' ? 'border-primary text-primary' : 'border-transparent text-txt-muted hover:text-txt-main'}`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferência
            <Tooltip text="Mover estoque entre depósitos (Ex: Depósito -> Caminhão)." />
          </button>
          
          <button 
            onClick={() => setActiveTab('supply')}
            className={`pb-4 pt-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'supply' ? 'border-primary text-primary' : 'border-transparent text-txt-muted hover:text-txt-main'}`}
          >
            <Plus className="w-4 h-4" />
            Suprimento
            <Tooltip text="Entrada de estoque vindo de fornecedores ou compras." />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-app transition-colors">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* TAB: CONTAGEM (AJUSTE) */}
          {activeTab === 'count' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Header Info & Actions */}
              <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
                 <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-app rounded-full border border-bdr">
                       <Factory className="w-6 h-6 text-txt-muted" />
                    </div>
                    <div className="flex-1">
                       <label className="text-xs font-bold text-txt-muted uppercase block mb-1">Depósito Ativo</label>
                       {isAdmin ? (
                         <select 
                           value={currentDepositId}
                           onChange={(e) => setCurrentDepositId(e.target.value)}
                           className="bg-app border border-bdr text-txt-main font-bold rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[200px]"
                           disabled={!depositOptions.length}
                         >
                           <option value="" disabled>Selecione um depósito...</option>
                           {depositOptions.map((d) => (
                             <option key={d.id} value={d.id}>{d.nome}</option>
                           ))}
                         </select>
                       ) : (
                         <div className="text-lg font-black text-txt-main">{findDepositName(currentDepositId)}</div>
                       )}
                    </div>
                 </div>

                 <div className="flex gap-3 w-full md:w-auto">
                    <button 
                       onClick={refreshData}
                       className="flex-1 md:flex-none px-4 py-2 border border-bdr text-txt-muted hover:bg-app hover:text-txt-main rounded-lg text-sm font-bold transition-colors"
                    >
                      Recarregar
                    </button>
                    <button 
                       onClick={fillWithCurrent}
                       className="flex-1 md:flex-none px-4 py-2 border border-bdr text-txt-muted hover:bg-app hover:text-txt-main rounded-lg text-sm font-bold transition-colors"
                    >
                      Repetir Atual
                    </button>
                    <button 
                       onClick={clearCount}
                       className="flex-1 md:flex-none px-4 py-2 border border-bdr text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-sm font-bold transition-colors"
                    >
                      Limpar
                    </button>
                 </div>
              </div>

              {/* Attention Banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                 <div className="text-sm text-txt-main">
                    <p className="font-bold text-amber-600 mb-1">Atenção na Contagem</p>
                    O ajuste de contagem é uma operação crítica. Ao salvar, a diferença (sobra ou falta) será aplicada imediatamente ao estoque físico do depósito selecionado e um log de auditoria será gerado.
                 </div>
              </div>

              {/* Count Table */}
              <div className="bg-surface rounded-xl shadow-sm border border-bdr overflow-hidden transition-colors">
                <table className="w-full text-left text-sm">
                  <thead className="bg-app border-b border-bdr text-xs uppercase font-bold text-txt-muted">
                    <tr>
                      <th className="px-6 py-4">Produto</th>
                      <th className="px-6 py-4 text-center w-32">Estoque Atual</th>
                      <th className="px-6 py-4 text-center w-40 bg-primary/5 text-primary border-x border-primary/10">Contagem Física</th>
                      <th className="px-6 py-4 text-center w-32">Diferença</th>
                      <th className="px-6 py-4 text-center w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {products.map(p => {
                      const current = getProductStock(p.id);
                      const diff = getDivergence(p.id, current);
                      const hasInput = countInputs[p.id] !== '' && countInputs[p.id] !== undefined;
                      
                      return (
                        <tr key={p.id} className={`transition-colors ${hasInput ? 'bg-primary/5' : 'hover:bg-app'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded flex items-center justify-center border ${hasInput ? 'bg-primary text-white border-primary' : 'bg-app text-txt-muted border-bdr'}`}>
                                  {p.tipo.includes('GAS') ? <Cylinder className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                               </div>
                               <div>
                                 <p className="font-bold text-txt-main">{p.nome}</p>
                                 <p className="text-[10px] text-txt-muted">{p.tipo}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-txt-muted text-lg">
                            {current}
                          </td>
                          <td className="px-6 py-4 text-center border-x border-bdr/50">
                            <input 
                              type="number" 
                              min="0"
                              placeholder="-"
                              value={countInputs[p.id] ?? ''}
                              onChange={(e) => handleCountChange(p.id, e.target.value)}
                              className="w-24 text-center font-black text-lg bg-surface border-2 border-bdr rounded-lg py-1 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-txt-main placeholder:text-txt-muted/30"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            {hasInput && (
                              <span className={`font-black text-lg ${diff! > 0 ? 'text-emerald-500' : diff! < 0 ? 'text-red-500' : 'text-txt-muted'}`}>
                                {diff! > 0 ? '+' : ''}{diff}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {hasInput ? (
                               diff === 0 ? (
                                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase border border-emerald-500/20">
                                   <CheckCircle2 className="w-3 h-3" /> OK
                                 </span>
                               ) : diff! > 0 ? (
                                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase border border-blue-500/20">
                                   Sobra
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-600 text-[10px] font-black uppercase border border-red-500/20">
                                   Falta
                                 </span>
                               )
                            ) : (
                              <span className="text-txt-muted opacity-30 text-xs font-medium">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Save Action */}
              <div className="bg-surface p-6 rounded-xl shadow-lg border border-bdr flex justify-between items-center transition-colors">
                 <div className="text-sm text-txt-muted">
                    Itens contados: <strong className="text-txt-main">{Object.values(countInputs).filter(v => v !== '').length}</strong> de {products.length}
                 </div>
                 <button 
                   onClick={handleSaveCount}
                   className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                 >
                   <Save className="w-5 h-5" />
                   REGISTRAR AJUSTE DE CONTAGEM
                 </button>
              </div>

            </div>
          )}

          {/* TAB: SANGRIA (SAÍDA) */}
          {activeTab === 'bleed' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Header Info */}
              <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20">
                      <Minus className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-txt-main">Registrar Saída Manual (Sangria)</h3>
                      <p className="text-xs text-txt-muted">Use para registrar perdas, quebras, consumo interno ou doações.</p>
                  </div>
                </div>
                <div className="bg-app px-4 py-2 rounded-lg border border-bdr">
                   <span className="text-xs font-bold text-txt-muted uppercase mr-2">Depósito Origem:</span>
                   {isAdmin ? (
                     <select 
                       value={currentDepositId}
                       onChange={(e) => setCurrentDepositId(e.target.value)}
                       className="bg-transparent text-txt-main font-black text-sm outline-none cursor-pointer"
                       disabled={!depositOptions.length}
                     >
                        <option value="" disabled>Selecione...</option>
                        {depositOptions.map((d) => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                     </select>
                   ) : (
                     <span className="font-black text-txt-main text-sm">{findDepositName(currentDepositId)}</span>
                   )}
                </div>
              </div>

              {/* Form Area */}
              <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr transition-colors">
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    
                    {/* Produto Select */}
                    <div className="md:col-span-4 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Produto</label>
                       <select 
                         value={bleedForm.produtoId}
                         onChange={(e) => setBleedForm({...bleedForm, produtoId: e.target.value})}
                         className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main focus:ring-2 focus:ring-primary outline-none"
                       >
                         <option value="">Selecione um produto...</option>
                         {products.map(p => (
                           <option key={p.id} value={p.id}>{p.nome}</option>
                         ))}
                       </select>
                    </div>

                    {/* Estoque Atual Readonly */}
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Estoque Atual</label>
                       <div className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-mono font-bold text-txt-muted text-center">
                          {bleedForm.produtoId ? getProductStock(bleedForm.produtoId) : '-'}
                       </div>
                    </div>

                    {/* Quantidade Input */}
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Qtd. Saída</label>
                       <input 
                         type="number"
                         min="1"
                         value={bleedForm.quantidade}
                         onChange={(e) => setBleedForm({...bleedForm, quantidade: e.target.value})}
                         placeholder="0"
                         className="w-full bg-surface border-2 border-bdr rounded-xl p-3 text-sm font-black text-red-500 focus:border-red-500 outline-none text-center"
                       />
                    </div>

                    {/* Motivo Select */}
                    <div className="md:col-span-4 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Motivo (Obrigatório)</label>
                       <select 
                         value={bleedForm.motivo}
                         onChange={(e) => setBleedForm({...bleedForm, motivo: e.target.value})}
                         className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main focus:ring-2 focus:ring-primary outline-none"
                       >
                         <option value="">Selecione...</option>
                         <option value="PERDA">Perda / Extravio</option>
                         <option value="QUEBRA">Quebra / Avaria</option>
                         <option value="CONSUMO">Consumo Interno</option>
                         <option value="DOACAO">Doação / Bonificação</option>
                         <option value="AJUSTE">Ajuste Operacional</option>
                       </select>
                    </div>

                    {/* Obs Input (Full width next row) */}
                    <div className="md:col-span-10 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Observação (Opcional)</label>
                       <input 
                         type="text"
                         value={bleedForm.obs}
                         onChange={(e) => setBleedForm({...bleedForm, obs: e.target.value})}
                         placeholder="Detalhes adicionais..."
                         className="w-full bg-app border border-bdr rounded-xl p-3 text-sm text-txt-main focus:ring-2 focus:ring-primary outline-none"
                       />
                    </div>

                    {/* Add Button */}
                    <div className="md:col-span-2">
                       <button 
                         onClick={handleAddBleedItem}
                         className="w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl font-bold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                       >
                         <Plus className="w-4 h-4" /> Adicionar
                       </button>
                    </div>
                 </div>
              </div>

              {/* Staging List */}
              <div className="bg-surface rounded-xl shadow-sm border border-bdr overflow-hidden transition-colors">
                <div className="p-4 bg-app border-b border-bdr flex justify-between items-center">
                   <h4 className="text-xs font-black text-txt-muted uppercase tracking-widest">Itens a Registrar</h4>
                   <span className="text-xs font-bold text-txt-main bg-surface px-2 py-1 rounded border border-bdr">{bleedStaging.length} itens</span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs uppercase font-bold text-txt-muted border-b border-bdr">
                    <tr>
                      <th className="px-6 py-3">Produto</th>
                      <th className="px-6 py-3 text-center">Saída</th>
                      <th className="px-6 py-3 text-center">Prévia Estoque</th>
                      <th className="px-6 py-3">Motivo</th>
                      <th className="px-6 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {bleedStaging.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-txt-muted italic opacity-50">
                           Nenhum item adicionado para sangria.
                        </td>
                      </tr>
                    ) : (
                      bleedStaging.map(item => (
                        <tr key={item.id} className="hover:bg-app transition-colors">
                          <td className="px-6 py-4 font-bold text-txt-main">{item.produtoNome}</td>
                          <td className="px-6 py-4 text-center font-black text-red-500">-{item.quantidade}</td>
                          <td className="px-6 py-4 text-center text-txt-muted font-mono">
                             {item.estoqueAtual} <ArrowRight className="w-3 h-3 inline mx-1" /> <strong className="text-txt-main">{item.estoqueAtual - item.quantidade}</strong>
                          </td>
                          <td className="px-6 py-4">
                             <span className="block font-bold text-xs text-txt-main">{item.motivo}</span>
                             <span className="block text-[10px] text-txt-muted truncate max-w-[150px]">{item.obs}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button 
                               onClick={() => handleRemoveBleedItem(item.id)}
                               className="text-txt-muted hover:text-red-500 p-2 transition-colors"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Save Action */}
              <div className="flex justify-end pt-4">
                 <button 
                   onClick={handleSaveBleed}
                   disabled={bleedStaging.length === 0}
                   className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-black shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center gap-3 text-sm"
                 >
                   <AlertCircle className="w-5 h-5" />
                   CONFIRMAR SANGRIA DE ESTOQUE
                 </button>
              </div>

            </div>
          )}

          {/* TAB: TRANSFERÊNCIA */}
          {activeTab === 'transfer' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              <div className="bg-surface p-8 rounded-xl shadow-sm border border-bdr transition-colors">
                <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                  
                  {/* Origem */}
                  <div className="flex-1 w-full p-6 bg-app rounded-2xl border border-bdr flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-txt-muted">
                      <Package className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Origem (Sai)</span>
                    </div>
                    <select 
                      value={transferForm.originId}
                      onChange={(e) => setTransferForm({...transferForm, originId: e.target.value})}
                      className="w-full bg-surface border border-bdr p-3 rounded-xl text-lg font-black text-txt-main outline-none focus:ring-2 focus:ring-primary"
                      disabled={!depositOptions.length}
                    >
                      <option value="" disabled>Selecione...</option>
                      {depositOptions.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    {/* Saldo da Origem */}
                    {transferForm.produtoId && (
                      <div className="text-center bg-surface p-2 rounded-lg border border-bdr">
                        <span className="text-xs text-txt-muted block">Disponível na Origem</span>
                        <span className="text-xl font-mono font-bold text-txt-main">{getProductStock(transferForm.produtoId)}</span>
                      </div>
                    )}
                  </div>

                  {/* Icon */}
                  <div className="bg-primary/10 p-4 rounded-full text-primary shadow-sm border border-primary/20">
                    <ArrowRight className="w-8 h-8" strokeWidth={3} />
                  </div>

                  {/* Destino */}
                  <div className="flex-1 w-full p-6 bg-app rounded-2xl border border-bdr flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-txt-muted">
                      <Truck className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Destino (Entra)</span>
                    </div>
                    <select 
                      value={transferForm.destId}
                      onChange={(e) => setTransferForm({...transferForm, destId: e.target.value})}
                      className="w-full bg-surface border border-bdr p-3 rounded-xl text-lg font-black text-txt-main outline-none focus:ring-2 focus:ring-primary"
                      disabled={!depositOptions.length}
                    >
                      <option value="" disabled>Selecione...</option>
                      {depositOptions.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>

                </div>

                <div className="my-8 border-t border-bdr"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-txt-muted uppercase ml-1">Produto a Transferir</label>
                    <select 
                      value={transferForm.produtoId}
                      onChange={(e) => setTransferForm({...transferForm, produtoId: e.target.value})}
                      className="w-full bg-app border border-bdr rounded-xl p-4 text-base font-bold text-txt-main focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Selecione...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-txt-muted uppercase ml-1">Quantidade</label>
                    <input 
                      type="number"
                      min="1"
                      value={transferForm.quantidade}
                      onChange={(e) => setTransferForm({...transferForm, quantidade: e.target.value})}
                      placeholder="0"
                      className="w-full bg-app border border-bdr rounded-xl p-4 text-base font-black text-txt-main focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={handleTransfer}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 w-full md:w-auto justify-center"
                  >
                    <ArrowRightLeft className="w-5 h-5" />
                    CONFIRMAR TRANSFERÊNCIA
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* TAB: SUPRIMENTO (ENTRADA) */}
          {activeTab === 'supply' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Header Info */}
              <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      <Plus className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-txt-main">Registrar Entrada (Suprimento)</h3>
                      <p className="text-xs text-txt-muted">Use para registrar compras, bonificações recebidas ou ajustes positivos.</p>
                  </div>
                </div>
                <div className="bg-app px-4 py-2 rounded-lg border border-bdr">
                   <span className="text-xs font-bold text-txt-muted uppercase mr-2">Depósito Destino:</span>
                   {isAdmin ? (
                     <select 
                       value={supplyForm.depositId}
                       onChange={(e) => setSupplyForm({...supplyForm, depositId: e.target.value})}
                       className="bg-transparent text-txt-main font-black text-sm outline-none cursor-pointer"
                       disabled={!depositOptions.length}
                     >
                        <option value="" disabled>Selecione...</option>
                        {depositOptions.map((d) => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                     </select>
                   ) : (
                     <span className="font-black text-txt-main text-sm">{findDepositName(supplyForm.depositId)}</span>
                   )}
                </div>
              </div>

              {/* Form Area */}
              <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr transition-colors">
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    
                    {/* Produto Select */}
                    <div className="md:col-span-4 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Produto</label>
                       <select 
                         value={supplyForm.produtoId}
                         onChange={(e) => setSupplyForm({...supplyForm, produtoId: e.target.value})}
                         className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main focus:ring-2 focus:ring-primary outline-none"
                       >
                         <option value="">Selecione um produto...</option>
                         {products.map(p => (
                           <option key={p.id} value={p.id}>{p.nome}</option>
                         ))}
                       </select>
                    </div>

                    {/* Estoque Atual Readonly */}
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Estoque Atual</label>
                       <div className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-mono font-bold text-txt-muted text-center">
                          {supplyForm.produtoId ? getProductStock(supplyForm.produtoId) : '-'}
                       </div>
                    </div>

                    {/* Quantidade Input */}
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Qtd. Entrada</label>
                       <input 
                         type="number"
                         min="1"
                         value={supplyForm.quantidade}
                         onChange={(e) => setSupplyForm({...supplyForm, quantidade: e.target.value})}
                         placeholder="0"
                         className="w-full bg-surface border-2 border-bdr rounded-xl p-3 text-sm font-black text-emerald-500 focus:border-emerald-500 outline-none text-center"
                       />
                    </div>

                    {/* Origem/Fornecedor Input */}
                    <div className="md:col-span-4 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Origem / Fornecedor</label>
                       <input 
                         type="text"
                         value={supplyForm.origem}
                         onChange={(e) => setSupplyForm({...supplyForm, origem: e.target.value})}
                         placeholder="Ex: Nacional Gás, NF 1234"
                         className="w-full bg-app border border-bdr rounded-xl p-3 text-sm text-txt-main focus:ring-2 focus:ring-primary outline-none"
                       />
                    </div>

                    {/* Obs Input (Full width next row) */}
                    <div className="md:col-span-12 space-y-2">
                       <label className="text-xs font-bold text-txt-muted uppercase ml-1">Observação (Opcional)</label>
                       <input 
                         type="text"
                         value={supplyForm.obs}
                         onChange={(e) => setSupplyForm({...supplyForm, obs: e.target.value})}
                         placeholder="Detalhes adicionais..."
                         className="w-full bg-app border border-bdr rounded-xl p-3 text-sm text-txt-main focus:ring-2 focus:ring-primary outline-none"
                       />
                    </div>

                 </div>

                 <div className="mt-8 flex justify-end">
                   <button 
                     onClick={handleSupply}
                     className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-3 text-sm"
                   >
                     <Boxes className="w-5 h-5" />
                     CONFIRMAR ENTRADA DE ESTOQUE
                   </button>
                 </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
