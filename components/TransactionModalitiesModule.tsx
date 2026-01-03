
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, Plus, Trash2, Edit2, 
  Settings, Layers, Tag, Box, 
  ArrowRight, RefreshCw, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { 
  ModalidadeVenda, RotuloModalidade, RegraEstoqueModalidade, 
  Produto, DepositoFisicoId 
} from '../src/domain/types';
import { 
  getSalesModalities, saveSalesModalities, 
  getModalityLabels, saveModalityLabels, 
  getStockRules, saveStockRules,
  getProducts 
} from '../src/domain/storage';
import { listDeposits } from '../src/domain/repositories/deposits.repo';
import { Deposit } from '../src/domain/types';

interface TransactionModalitiesModuleProps {
  onClose: () => void;
}

type TabType = 'modalities' | 'labels' | 'rules';

export const TransactionModalitiesModule: React.FC<TransactionModalitiesModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('modalities');
  const [loading, setLoading] = useState(true);

  // -- Data Stores --
  const [modalities, setModalities] = useState<ModalidadeVenda[]>([]);
  const [labels, setLabels] = useState<RotuloModalidade[]>([]);
  const [rules, setRules] = useState<RegraEstoqueModalidade[]>([]);
  const [products, setProducts] = useState<Produto[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  // -- UI States for Forms --
  const [modalityForm, setModalityForm] = useState<Partial<ModalidadeVenda>>({});
  const [isModalityModalOpen, setIsModalityModalOpen] = useState(false);

  // -- Labels Filter --
  const [selectedDepositForLabels, setSelectedDepositForLabels] = useState<DepositoFisicoId>('DEP1');

  // -- Rules Filter --
  const [selectedModalityForRules, setSelectedModalityForRules] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [mods, labs, ruls, prods, deps] = await Promise.all([
        Promise.resolve(getSalesModalities()),
        Promise.resolve(getModalityLabels()),
        Promise.resolve(getStockRules()),
        Promise.resolve(getProducts()),
        listDeposits()
      ]);
      setModalities(mods);
      setLabels(labs);
      setRules(ruls);
      setProducts(prods);
      setDeposits(deps);
      if (deps.length > 0) {
        setSelectedDepositForLabels(deps[0].id);
      }
      setLoading(false);
    })();
  }, []);

  // Set default selected modality for rules after loading
  useEffect(() => {
    if (modalities.length > 0 && !selectedModalityForRules) {
      setSelectedModalityForRules(modalities[0].id);
    }
  }, [modalities]);

  // ==================================================================================
  // LOGIC: MODALITIES
  // ==================================================================================
  
  const handleSaveModality = () => {
    if (!modalityForm.nomePadrao || !modalityForm.codigo) return alert("Nome e Código são obrigatórios.");
    
    const newMod: ModalidadeVenda = {
      id: modalityForm.id || crypto.randomUUID(),
      codigo: modalityForm.codigo.toUpperCase(),
      nomePadrao: modalityForm.nomePadrao,
      ordem: modalityForm.ordem || (modalities.length + 1),
      ativo: modalityForm.ativo ?? true
    };

    let updated;
    if (modalityForm.id) {
      updated = modalities.map(m => m.id === newMod.id ? newMod : m);
    } else {
      updated = [...modalities, newMod];
    }
    
    updated.sort((a, b) => a.ordem - b.ordem);
    saveSalesModalities(updated);
    setModalities(updated);
    setIsModalityModalOpen(false);
  };

  const handleDeleteModality = (id: string) => {
    if (!confirm("Excluir modalidade? Regras associadas podem quebrar.")) return;
    const updated = modalities.filter(m => m.id !== id);
    saveSalesModalities(updated);
    setModalities(updated);
  };

  // ==================================================================================
  // LOGIC: LABELS (Rótulos por Depósito)
  // ==================================================================================

  const getLabelFor = (modId: string, depId: string) => {
    return labels.find(l => l.modalidadeId === modId && l.depositoId === depId)?.nomeExibicao || '';
  };

  const handleLabelChange = (modId: string, newVal: string) => {
    const existingIndex = labels.findIndex(l => l.modalidadeId === modId && l.depositoId === selectedDepositForLabels);
    let updatedLabels = [...labels];

    if (existingIndex >= 0) {
      if (newVal.trim() === '') {
        // Remove override if empty (revert to default)
        updatedLabels.splice(existingIndex, 1);
      } else {
        updatedLabels[existingIndex] = { ...updatedLabels[existingIndex], nomeExibicao: newVal };
      }
    } else if (newVal.trim() !== '') {
      updatedLabels.push({
        id: crypto.randomUUID(),
        modalidadeId: modId,
        depositoId: selectedDepositForLabels,
        nomeExibicao: newVal
      });
    }

    setLabels(updatedLabels);
    saveModalityLabels(updatedLabels);
  };

  // ==================================================================================
  // LOGIC: STOCK RULES
  // ==================================================================================

  const currentRules = useMemo(() => {
    return rules.filter(r => r.modalidadeId === selectedModalityForRules);
  }, [rules, selectedModalityForRules]);

  const handleAddRule = () => {
    const newRule: RegraEstoqueModalidade = {
      id: crypto.randomUUID(),
      modalidadeId: selectedModalityForRules,
      produtoPrincipalId: products[0]?.id || '',
      produtoSaidaId: null,
      fatorSaida: 1,
      produtoEntradaId: null,
      fatorEntrada: 1
    };
    const updated = [...rules, newRule];
    setRules(updated);
    saveStockRules(updated);
  };

  const handleUpdateRule = (ruleId: string, field: keyof RegraEstoqueModalidade, value: any) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r);
    setRules(updated);
    saveStockRules(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    setRules(updated);
    saveStockRules(updated);
  };

  // ==================================================================================
  // RENDER
  // ==================================================================================

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/10 p-2 rounded-xl border border-teal-500/20">
            <Settings className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Modalidades de Venda</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Configuração de Regras de Negócio</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-red-500/10 hover:text-red-500 text-txt-muted rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-surface border-b border-bdr px-6">
        <div className="flex gap-8">
          <button 
            onClick={() => setActiveTab('modalities')}
            className={`pb-4 pt-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${
              activeTab === 'modalities' ? 'border-teal-500 text-teal-600' : 'border-transparent text-txt-muted hover:text-txt-main'
            }`}
          >
            <Layers className="w-4 h-4" /> Cadastro de Modalidades
          </button>
          <button 
            onClick={() => setActiveTab('labels')}
            className={`pb-4 pt-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${
              activeTab === 'labels' ? 'border-teal-500 text-teal-600' : 'border-transparent text-txt-muted hover:text-txt-main'
            }`}
          >
            <Tag className="w-4 h-4" /> Rótulos por Depósito
          </button>
          <button 
            onClick={() => setActiveTab('rules')}
            className={`pb-4 pt-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${
              activeTab === 'rules' ? 'border-teal-500 text-teal-600' : 'border-transparent text-txt-muted hover:text-txt-main'
            }`}
          >
            <Box className="w-4 h-4" /> Regras de Estoque
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-app">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* TAB 1: MODALITIES */}
          {activeTab === 'modalities' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button 
                  onClick={() => { setModalityForm({ ativo: true, ordem: modalities.length + 1 }); setIsModalityModalOpen(true); }}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Plus className="w-4 h-4" /> NOVA MODALIDADE
                </button>
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-bdr overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-app border-b border-bdr text-xs font-black text-txt-muted uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 w-20 text-center">Ordem</th>
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Nome Padrão</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {modalities.map(m => (
                      <tr key={m.id} className="hover:bg-app transition-colors group">
                        <td className="px-6 py-4 text-center font-bold text-txt-muted">{m.ordem}</td>
                        <td className="px-6 py-4 font-mono font-bold text-teal-600">{m.codigo}</td>
                        <td className="px-6 py-4 font-medium text-txt-main">{m.nomePadrao}</td>
                        <td className="px-6 py-4 text-center">
                          {m.ativo ? 
                            <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-black uppercase">Ativo</span> : 
                            <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-black uppercase">Inativo</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setModalityForm(m); setIsModalityModalOpen(true); }} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteModality(m.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LABELS */}
          {activeTab === 'labels' && (
            <div className="space-y-4">
              <div className="bg-surface p-4 rounded-xl border border-bdr flex items-center gap-4">
                 <label className="text-xs font-black text-txt-muted uppercase">Selecione o Depósito:</label>
                 <select 
                   value={selectedDepositForLabels}
                   onChange={(e) => setSelectedDepositForLabels(e.target.value)}
                   className="bg-app border border-bdr rounded-lg p-2 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-teal-500"
                 >
                   {deposits.map(dep => (
                     <option key={dep.id} value={dep.id}>{dep.name}</option>
                   ))}
                 </select>
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-bdr overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-app border-b border-bdr text-xs font-black text-txt-muted uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 w-32">Código</th>
                      <th className="px-6 py-4 w-1/3">Nome Padrão (Sistema)</th>
                      <th className="px-6 py-4">Rótulo no Depósito Selecionado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {modalities.map(m => {
                      const currentLabel = getLabelFor(m.id, selectedDepositForLabels);
                      return (
                        <tr key={m.id} className="hover:bg-app transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-teal-600">{m.codigo}</td>
                          <td className="px-6 py-4 text-txt-muted">{m.nomePadrao}</td>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              value={currentLabel}
                              placeholder={m.nomePadrao}
                              onChange={(e) => handleLabelChange(m.id, e.target.value)}
                              className={`w-full bg-app border border-bdr rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-teal-500 outline-none ${currentLabel ? 'text-teal-700 border-teal-200 bg-teal-50' : 'text-txt-main'}`}
                            />
                            {currentLabel && <span className="text-[10px] text-teal-600 font-medium mt-1 block">Personalizado</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="bg-surface p-4 rounded-xl border border-bdr flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <label className="text-xs font-black text-txt-muted uppercase">Configurar Regras para:</label>
                   <select 
                     value={selectedModalityForRules}
                     onChange={(e) => setSelectedModalityForRules(e.target.value)}
                     className="bg-app border border-bdr rounded-lg p-2 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
                   >
                     {modalities.map(m => (
                       <option key={m.id} value={m.id}>{m.nomePadrao}</option>
                     ))}
                   </select>
                 </div>
                 <button 
                   onClick={handleAddRule}
                   className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-black text-xs shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-transform active:scale-95"
                 >
                   <Plus className="w-3 h-3" /> NOVA REGRA
                 </button>
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-bdr overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-app border-b border-bdr text-xs font-black text-txt-muted uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-3 w-1/4">Quando vender... (Produto Principal)</th>
                      <th className="px-4 py-3 w-1/4 border-l border-bdr/50">Deve sair do Estoque...</th>
                      <th className="px-4 py-3 w-20 text-center">Fator</th>
                      <th className="px-4 py-3 w-1/4 border-l border-bdr/50">Deve entrar no Estoque...</th>
                      <th className="px-4 py-3 w-20 text-center">Fator</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {currentRules.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-txt-muted italic">Nenhuma regra configurada para esta modalidade. O estoque não será movimentado automaticamente.</td>
                      </tr>
                    ) : (
                      currentRules.map(rule => (
                        <tr key={rule.id} className="hover:bg-app transition-colors">
                          <td className="px-4 py-3">
                            <select 
                              value={rule.produtoPrincipalId}
                              onChange={(e) => handleUpdateRule(rule.id, 'produtoPrincipalId', e.target.value)}
                              className="w-full bg-app border border-bdr rounded-lg p-2 text-xs font-bold text-txt-main focus:ring-teal-500 outline-none"
                            >
                              {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                          </td>
                          
                          <td className="px-4 py-3 border-l border-bdr/50 bg-red-50/10">
                            <select 
                              value={rule.produtoSaidaId || ''}
                              onChange={(e) => handleUpdateRule(rule.id, 'produtoSaidaId', e.target.value || null)}
                              className="w-full bg-surface border border-bdr rounded-lg p-2 text-xs text-txt-main outline-none focus:ring-red-500"
                            >
                              <option value="">(Nada)</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input 
                              type="number" 
                              value={rule.fatorSaida} 
                              onChange={(e) => handleUpdateRule(rule.id, 'fatorSaida', parseFloat(e.target.value))}
                              className="w-16 text-center bg-surface border border-bdr rounded p-1 text-xs font-mono"
                            />
                          </td>

                          <td className="px-4 py-3 border-l border-bdr/50 bg-green-50/10">
                            <select 
                              value={rule.produtoEntradaId || ''}
                              onChange={(e) => handleUpdateRule(rule.id, 'produtoEntradaId', e.target.value || null)}
                              className="w-full bg-surface border border-bdr rounded-lg p-2 text-xs text-txt-main outline-none focus:ring-green-500"
                            >
                              <option value="">(Nada)</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input 
                              type="number" 
                              value={rule.fatorEntrada} 
                              onChange={(e) => handleUpdateRule(rule.id, 'fatorEntrada', parseFloat(e.target.value))}
                              className="w-16 text-center bg-surface border border-bdr rounded p-1 text-xs font-mono"
                            />
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDeleteRule(rule.id)} className="text-txt-muted hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: CREATE/EDIT MODALITY */}
      {isModalityModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-bdr overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-app px-6 py-4 border-b border-bdr flex justify-between items-center">
              <h3 className="font-black text-lg text-txt-main flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-500" />
                {modalityForm.id ? 'Editar Modalidade' : 'Nova Modalidade'}
              </h3>
              <button onClick={() => setIsModalityModalOpen(false)} className="hover:bg-bdr p-1 rounded-full"><X className="w-5 h-5 text-txt-muted" /></button>
            </div>
            
            <div className="p-6 space-y-4">
               <div>
                 <label className="block text-xs font-bold text-txt-muted uppercase mb-1">Nome Padrão</label>
                 <input 
                   type="text" 
                   value={modalityForm.nomePadrao || ''} 
                   onChange={e => setModalityForm({...modalityForm, nomePadrao: e.target.value})}
                   className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-teal-500"
                   placeholder="Ex: Venda Direta"
                   autoFocus
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-txt-muted uppercase mb-1">Código (Sistema)</label>
                   <input 
                     type="text" 
                     value={modalityForm.codigo || ''} 
                     onChange={e => setModalityForm({...modalityForm, codigo: e.target.value.toUpperCase()})}
                     className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-mono font-bold text-teal-600 outline-none focus:ring-2 focus:ring-teal-500 uppercase"
                     placeholder="VENDA"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-txt-muted uppercase mb-1">Ordem</label>
                   <input 
                     type="number" 
                     value={modalityForm.ordem || 0} 
                     onChange={e => setModalityForm({...modalityForm, ordem: parseInt(e.target.value)})}
                     className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-teal-500"
                   />
                 </div>
               </div>

               <div className="flex items-center gap-3 p-3 bg-app rounded-xl border border-bdr">
                  <input 
                    type="checkbox" 
                    id="modActive"
                    checked={modalityForm.ativo ?? true}
                    onChange={e => setModalityForm({...modalityForm, ativo: e.target.checked})}
                    className="w-5 h-5 text-teal-500 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="modActive" className="text-sm font-bold text-txt-main cursor-pointer select-none">
                    Modalidade Ativa
                  </label>
               </div>
            </div>

            <div className="p-6 border-t border-bdr bg-app flex justify-end gap-3">
              <button onClick={() => setIsModalityModalOpen(false)} className="px-4 py-2 text-txt-muted font-bold hover:bg-bdr rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSaveModality} className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-lg shadow-lg shadow-teal-500/20 transition-all active:scale-95">Salvar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
