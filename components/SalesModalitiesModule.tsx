import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Plus, Pencil, Trash2, Search, Settings, Smartphone, CheckCircle2, Banknote
} from 'lucide-react';
import { Maquininha, Deposit } from '@/domain/types';
import { PaymentMethod, PaymentMethodDepositConfig } from '@/types';
import {
  deleteMachine,
  listMachines,
  listDeposits,
  recordAudit,
  upsertMachine,
} from '@/utils/legacyHelpers';
import {
  deletePaymentMethod,
  listPaymentMethods,
  listPaymentMethodDepositConfigs,
} from '@/services';
// ⚠️ REMOVIDO v3.0 (use Services):
// import {
//   deleteMachine,
//   deletePaymentMethod,
//   listMachines,
//   listPaymentMethods,
//   upsertMachine,
//   recordAudit,
//   listDeposits,
// } from '@/domain/repositories/index';
import { PaymentMethodsModal } from './PaymentMethodsModal';
import { PaymentMethodsList } from './PaymentMethodsList';
import { supabase } from '@/utils/supabaseClient';

interface SalesModalitiesModuleProps {
  onClose: () => void;
}

export const SalesModalitiesModule: React.FC<SalesModalitiesModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'methods' | 'machines'>('methods');
  
  // -- Data State --
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodConfigs, setMethodConfigs] = useState<PaymentMethodDepositConfig[]>([]);
  const [machines, setMachines] = useState<Maquininha[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  // -- UI State --
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // -- Forms State --
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [machineForm, setMachineForm] = useState<Partial<Maquininha>>({});
  const [userId, setUserId] = useState<string | null>(null);

  const refreshMethods = useCallback(async () => {
    const pm = await listPaymentMethods();
    setMethods(pm);
  }, []);

  const refreshMethodConfigs = useCallback(async () => {
    const configs = await listPaymentMethodDepositConfigs();
    setMethodConfigs(configs);
  }, []);

  // -- Load Data --
  useEffect(() => {
    let alive = true;
    (async () => {
      const [pm, mac, deps, configs] = await Promise.all([
        listPaymentMethods(),
        listMachines(),
        listDeposits(),
        listPaymentMethodDepositConfigs(),
      ]);
      if (!alive) return;

      setMethods(pm);
      setMachines(mac);
      setDeposits(deps);
      setMethodConfigs(configs);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // -- Handlers: Methods --
  const handleDeleteMethod = async (id: string) => {
    if(!confirm("Tem certeza? Isso pode afetar relatórios antigos.")) return;

    await deletePaymentMethod(id);
    await refreshMethods();
    await refreshMethodConfigs();
  };

  // -- Handlers: Machines --
  const handleSaveMachine = async () => {
    if (!machineForm.nome) return alert("Nome da maquininha é obrigatório");

    const newMachine: Maquininha = {
      id: machineForm.id || crypto.randomUUID(),
      nome: machineForm.nome,
      taxaDebito: Number(machineForm.taxaDebito) || 0,
      taxaCreditoVista: Number(machineForm.taxaCreditoVista) || 0,
      taxaCreditoParcelado: Number(machineForm.taxaCreditoParcelado) || 0,
      depositosPermitidos: machineForm.depositosPermitidos || [],
      ativo: machineForm.ativo ?? true
    };

    await upsertMachine(newMachine);
    const refreshed = await listMachines();
    setMachines(refreshed);
    setIsMachineModalOpen(false);

    await recordAudit({
      usuario_id: userId,
      deposit_id: undefined,
      entidade: 'PAGAMENTO',
      entidade_id: newMachine.id,
      acao: 'UPDATE',
      depois_json: newMachine,
      antes_json: machineForm.id ? machines.find((m) => m.id === machineForm.id) : undefined,
    });
  };

  const handleDeleteMachine = async (id: string) => {
    if(!confirm("Excluir maquininha?")) return;
    await deleteMachine(id);
    const refreshed = await listMachines();
    setMachines(refreshed);
  };

  // -- Render Helpers --
  const filteredMethods = methods.filter(m => (m.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredMachines = machines.filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-app/90 backdrop-blur-sm z-50 flex flex-col animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
            <Settings className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Formas de Pagamento & Máquinas</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Configuração Financeira</p>
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
            onClick={() => setActiveTab('methods')}
            className={`pb-4 pt-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${
              activeTab === 'methods' 
                ? 'border-emerald-500 text-emerald-600' 
                : 'border-transparent text-txt-muted hover:text-txt-main'
            }`}
          >
            <Banknote className="w-4 h-4" /> Formas de Pagamento
          </button>
          <button 
            onClick={() => setActiveTab('machines')}
            className={`pb-4 pt-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${
              activeTab === 'machines' 
                ? 'border-emerald-500 text-emerald-600' 
                : 'border-transparent text-txt-muted hover:text-txt-main'
            }`}
          >
            <Smartphone className="w-4 h-4" /> Máquinas de Cartão
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-app">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Toolbar */}
          <div className="bg-surface p-4 rounded-xl shadow-sm border border-bdr flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder={activeTab === 'methods' ? "Buscar forma de pagamento..." : "Buscar maquininha..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-app border border-bdr rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-txt-main font-bold"
                />
             </div>
             <button 
               onClick={() => {
                 if (activeTab === 'methods') {
                   setSelectedMethod(null);
                   setIsMethodModalOpen(true);
                 } else {
                   setMachineForm({ ativo: true, depositosPermitidos: [] });
                   setIsMachineModalOpen(true);
                 }
               }}
               className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
             >
               <Plus className="w-4 h-4" /> 
               {activeTab === 'methods' ? 'NOVA FORMA PAGTO' : 'NOVA MAQUININHA'}
             </button>
          </div>

          {/* TAB: METHODS */}
          {activeTab === 'methods' && (
            <div className="bg-surface rounded-2xl shadow-sm border border-bdr p-4 overflow-hidden animate-in fade-in">
              <PaymentMethodsList 
                methods={filteredMethods}
                configs={methodConfigs}
                deposits={deposits}
                onEdit={(m) => { setSelectedMethod(m); setIsMethodModalOpen(true); }}
                onDelete={handleDeleteMethod}
              />
            </div>
          )}

          {/* TAB: MACHINES */}
          {activeTab === 'machines' && (
            <div className="bg-surface rounded-2xl shadow-sm border border-bdr overflow-hidden animate-in fade-in">
              <table className="w-full text-left text-sm">
                <thead className="bg-app border-b border-bdr text-xs font-black text-txt-muted uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Nome da Maquininha</th>
                    <th className="px-6 py-4 text-center">Taxa Débito</th>
                    <th className="px-6 py-4 text-center">Taxa Crédito Vista</th>
                    <th className="px-6 py-4 text-center">Taxa Crédito Parc.</th>
                    <th className="px-6 py-4">Depósitos Permitidos</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr">
                  {filteredMachines.map(m => (
                    <tr key={m.id} className="hover:bg-app transition-colors group">
                      <td className="px-6 py-4 font-bold text-txt-main flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-txt-muted" />
                        {m.nome}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-txt-main">{m.taxaDebito}%</td>
                      <td className="px-6 py-4 text-center font-mono text-txt-main">{m.taxaCreditoVista}%</td>
                      <td className="px-6 py-4 text-center font-mono text-txt-main">{m.taxaCreditoParcelado}%</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {m.depositosPermitidos.map(d => (
                            <span key={d} className="px-2 py-0.5 bg-app border border-bdr rounded text-[10px] font-bold text-txt-muted uppercase">
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setMachineForm(m); setIsMachineModalOpen(true); }} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteMachine(m.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      <PaymentMethodsModal 
        isOpen={isMethodModalOpen}
        onClose={() => setIsMethodModalOpen(false)}
        deposits={deposits}
        configs={methodConfigs}
        initialMethod={selectedMethod}
        onSaved={async (saved) => {
          if (!saved || !saved.id) {
            console.error('Erro: Método de pagamento salvo é inválido.', saved);
            return;
          }
          await refreshMethods();
          await refreshMethodConfigs();
          await recordAudit({
            usuario_id: userId,
            deposit_id: undefined,
            entidade: 'PAGAMENTO',
            entidade_id: saved.id,
            acao: 'UPDATE',
            depois_json: saved,
            antes_json: selectedMethod,
          });
        }}
      />

      {/* --- MODAL MAQUININHA --- */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-bdr overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-app px-6 py-4 border-b border-bdr flex justify-between items-center">
              <h3 className="font-black text-lg text-txt-main flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-500" />
                {machineForm.id ? 'Editar Maquininha' : 'Nova Maquininha'}
              </h3>
              <button onClick={() => setIsMachineModalOpen(false)} className="hover:bg-bdr p-1 rounded-full"><X className="w-5 h-5 text-txt-muted" /></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-txt-muted uppercase mb-1.5">Nome da Maquininha</label>
                <input 
                  type="text" 
                  value={machineForm.nome || ''} 
                  onChange={e => setMachineForm({...machineForm, nome: e.target.value})}
                  className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ex: Stone - Loja 1"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Taxa Débito', key: 'taxaDebito' },
                  { label: 'Crédito Vista', key: 'taxaCreditoVista' },
                  { label: 'Crédito Parc.', key: 'taxaCreditoParcelado' }
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-bold text-txt-muted uppercase mb-1.5 truncate">{field.label}</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={machineForm[field.key as keyof Maquininha] as number || ''} 
                        onChange={e => setMachineForm({...machineForm, [field.key]: e.target.value})}
                        className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none pr-8"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-3 text-xs font-bold text-txt-muted">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-muted uppercase mb-2">Depósitos Autorizados</label>
                <div className="space-y-2 bg-app p-4 rounded-xl border border-bdr">
                  {deposits.map(dep => (
                    <label key={dep.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-surface rounded-lg transition-colors">
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${machineForm.depositosPermitidos?.includes(dep.id) ? 'bg-emerald-500 border-emerald-500' : 'border-txt-muted bg-surface'}`}>
                        {machineForm.depositosPermitidos?.includes(dep.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={machineForm.depositosPermitidos?.includes(dep.id)}
                        onChange={() => {
                          const current = machineForm.depositosPermitidos || [];
                          if (current.includes(dep.id)) {
                            setMachineForm({ ...machineForm, depositosPermitidos: current.filter(d => d !== dep.id) });
                          } else {
                            setMachineForm({ ...machineForm, depositosPermitidos: [...current, dep.id] });
                          }
                        }}
                      />
                      <span className="text-sm font-bold text-txt-main">
                        {dep.nome}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-bdr bg-app flex justify-end gap-3">
              <button onClick={() => setIsMachineModalOpen(false)} className="px-4 py-2 text-txt-muted font-bold hover:bg-bdr rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSaveMachine} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95">Salvar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

