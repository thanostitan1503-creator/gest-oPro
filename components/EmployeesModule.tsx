
import React, { useState, useMemo } from 'react';
import { useLiveQuery, db, listEmployees } from '@/utils/legacyHelpers';
// ⚠️ REMOVIDO v3.0: useLiveQuery (use useState + useEffect + Services)
// ⚠️ REMOVIDO v3.0: db local (use Services: import { xxxService } from '@/services')
import { 
  X, Users, UserPlus, Search, 
  MapPin, Truck, Shield, BadgeCheck,
  MoreVertical, Edit2, Trash2, Key,
  Star, Clock, PackageCheck, History,
  Save, Phone, Lock, Eye, EyeOff,
  CheckSquare, Square, LayoutGrid, Ban, CheckCircle2
} from 'lucide-react';
import { Colaborador, Deposito } from '@/domain/types';
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
import { DASHBOARD_ITEMS } from '../constants';

interface EmployeesModuleProps {
  onClose: () => void;
}

interface DriverStats {
  deliveriesToday: number;
  deliveriesMonth: number;
  avgTime: number; // minutes
  rating: number; // 1-5
  recentOs: { id: string; time: string; address: string; status: 'DONE' | 'LATE' }[];
}

export const EmployeesModule: React.FC<EmployeesModuleProps> = ({ onClose }) => {
   // -- Data State (Reactive via useLiveQuery) --
   // ✅ Normalização de depositoId agora é feita automaticamente pelo repository
   const liveEmployees = useLiveQuery(() => listEmployees(), []);
   const liveDeposits = useLiveQuery(() => db.deposits.filter((d: any) => d.ativo !== false).toArray(), []);
   
   const employees = liveEmployees ?? [];
   const deposits = liveDeposits ?? [];
  
  // -- UI State --
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // -- Performance View State --
  const [selectedDriver, setSelectedDriver] = useState<Colaborador | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);

  // -- Form State --
  const [form, setForm] = useState<Partial<Colaborador>>({
    permissoes: []
  });

  // -- Helpers --
  const isGlobalRole = (cargo?: string) => cargo === 'ENTREGADOR' || cargo === 'GERENTE';
  
  const getDepositName = (id: string | undefined, cargo?: string) => {
    // Se não tem depósito E é cargo global, mostrar "Acesso Global"
    if (!id && isGlobalRole(cargo)) {
      return '🌐 Acesso Global (todos os depósitos)';
    }
    // Se não tem depósito E NÃO é cargo global, erro!
    if (!id) {
      return '⚠️ SEM DEPÓSITO (ERRO)';
    }
    return deposits.find(d => d.id === id)?.nome || 'Depósito não encontrado';
  };

  const generateMockStats = (driverId: string): DriverStats => {
    // Deterministic pseudo-random based on ID length for consistent demo
    const base = driverId.length;
    return {
      deliveriesToday: 12 + (base % 5),
      deliveriesMonth: 140 + (base * 10),
      avgTime: 20 + (base % 15),
      rating: 4.0 + (base % 10) / 10,
      recentOs: [
        { id: '20251001', time: '10:30', address: 'Rua das Flores, 123', status: 'DONE' },
        { id: '20251005', time: '11:15', address: 'Av. Brasil, 500', status: 'DONE' },
        { id: '20251009', time: '12:00', address: 'Centro, Rua 1', status: 'LATE' },
      ]
    };
  };

  const handleSelectDriver = async (driver: Colaborador) => {
      if (driver.cargo !== 'ENTREGADOR') return;
      setSelectedDriver(driver);
      try {
         // Verifica se tem histórico no Dexie
         const [orders, movements] = await Promise.all([
           db.service_orders.where('entregadorId').equals(driver.id).count(),
           db.stock_movements.where('usuarioId').equals(driver.id).count()
         ]);
         const hasHistory = orders > 0 || movements > 0;
         
         if (hasHistory) {
            setDriverStats(generateMockStats(driver.id));
         } else {
            setDriverStats(null);
         }
      } catch (err) {
         setDriverStats(null);
      }
  };

  const handleSave = () => {
    // ✅ VALIDAÇÕES OBRIGATÓRIAS
    if (!form.nome?.trim()) return alert("O campo Nome é obrigatório.");
    if (!form.cargo) return alert("O campo Cargo é obrigatório.");
    if (!form.username?.trim()) return alert("O campo Nome de Usuário é obrigatório.");
    
    // ⚠️ Validar depósito: obrigatório APENAS para cargos "locais" (não ENTREGADOR/GERENTE)
    if (!isGlobalRole(form.cargo) && !form.depositoId) {
      return alert("Selecione um depósito para este colaborador! Apenas ENTREGADOR e GERENTE têm acesso global.");
    }

    // ⚠️ Validar username único (não pode repetir)
    const usernameNormalized = form.username.trim().toLowerCase();
    const isUsernameExists = employees.some(
      emp => emp.id !== form.id && emp.username?.trim().toLowerCase() === usernameNormalized
    );
    if (isUsernameExists) {
      return alert(`❌ O nome de usuário "${form.username}" já existe! Cada nome de usuário deve ser único.`);
    }

    // ✅ Construção explícita do objeto
    const newEmp: Colaborador = {
      id: form.id || generateId(),
      nome: form.nome.trim(),
      cargo: form.cargo,
      depositoId: form.depositoId ?? undefined, // ✅ Usa ?? para preservar null/undefined, mas não string vazia
      telefone: form.telefone || '',
      username: form.username.trim().toLowerCase(), // Normalizar para lowercase
      password: form.password || '',
      ativo: form.ativo ?? true,
      permissoes: form.permissoes || []
    };

    console.log('💾 Salvando colaborador:', newEmp); // Debug: verificar o que está sendo salvo

    // Salva no Dexie + Outbox (useLiveQuery atualizará automaticamente a UI)
    upsertEmployee(newEmp).then(() => {
      console.log('✅ Colaborador salvo com sucesso!');
    }).catch(err => {
      console.error('❌ Erro ao salvar colaborador:', err);
      alert('Erro ao salvar colaborador.');
    });
    
    setIsModalOpen(false);
    setForm({ permissoes: [] });
  };

  const handleDelete = async (id: string) => {
    // 1. Verificar TODAS as dependências no Dexie
    const [
      orderCountAsDriver,      // Como entregador
      orderCountAsCreator,     // Como criador/atendente (usuarioId ou criado_por)
      movementCount,           // Movimentações de estoque
      cashFlowCount           // Entradas/saídas de caixa
    ] = await Promise.all([
      db.service_orders.where('entregadorId').equals(id).count(),
      db.service_orders.where('usuarioId').equals(id).count(),
      db.stock_movements.where('usuarioId').equals(id).count(),
      db.cash_flow_entries.where('usuarioId').equals(id).count()
    ]);
    
    const hasHistory = orderCountAsDriver > 0 || orderCountAsCreator > 0 || movementCount > 0 || cashFlowCount > 0;

    console.log('🔍 Verificação de histórico:', {
      colaborador: employees.find(e => e.id === id)?.nome,
      orderCountAsDriver,
      orderCountAsCreator,
      movementCount,
      cashFlowCount,
      hasHistory
    });

    if (hasHistory) {
      const detalhes = [
        orderCountAsDriver > 0 ? `${orderCountAsDriver} entregas` : null,
        orderCountAsCreator > 0 ? `${orderCountAsCreator} ordens criadas` : null,
        movementCount > 0 ? `${movementCount} movimentações de estoque` : null,
        cashFlowCount > 0 ? `${cashFlowCount} operações de caixa` : null
      ].filter(Boolean).join(', ');
      
      if(!confirm(`Este colaborador possui histórico de movimentações:\n\n${detalhes}\n\nEle não pode ser excluído fisicamente para manter a integridade dos dados.\n\nDeseja DESATIVAR o acesso dele?`)) return;
      
      // Soft Delete (Deactivate)
      const emp = employees.find(e => e.id === id);
      if (emp) {
        await upsertEmployee({ ...emp, ativo: false });
        alert("Colaborador desativado com sucesso.");
      }
    } else {
      if(!confirm("Este colaborador não possui histórico. Deseja EXCLUIR permanentemente o registro?")) return;
      
      // Hard Delete
      await deleteEmployee(id);
      if(selectedDriver?.id === id) setSelectedDriver(null);
      alert("Colaborador excluído com sucesso.");
    }
  };

  const handleReactivate = async (id: string) => {
    if(!confirm("Reativar acesso deste colaborador?")) return;
    const emp = employees.find(e => e.id === id);
    if (emp) {
      await upsertEmployee({ ...emp, ativo: true });
    }
  }

  const handleFixUsersWithoutDeposit = async () => {
    const problemUsers = employees.filter(emp => {
      const isGlobal = emp.cargo === 'GERENTE' || emp.cargo === 'ENTREGADOR';
      return !isGlobal && !emp.depositoId;
    });
    
    console.log('🔍 Verificando usuários sem depósito:', {
      total: employees.length,
      problemUsers: problemUsers.map(u => ({ nome: u.nome, cargo: u.cargo, depositoId: u.depositoId }))
    });
    
    if (problemUsers.length === 0) {
      alert('✅ Nenhum usuário precisa de correção!');
      return;
    }
    
    if (deposits.length === 0) {
      alert('❌ Nenhum depósito disponível! Crie depósitos primeiro.');
      return;
    }
    
    const defaultDeposit = deposits[0];
    const msg = `Encontrados ${problemUsers.length} usuário(s) sem depósito:\n\n${problemUsers.map(u => `- ${u.nome} (${u.cargo})`).join('\n')}\n\nDeseja vincular todos ao depósito "${defaultDeposit.nome}"?`;
    
    if (!confirm(msg)) return;
    
    for (const user of problemUsers) {
      console.log('🔧 Corrigindo usuário:', user.nome, 'de', user.depositoId, 'para', defaultDeposit.id);
      await upsertEmployee({ ...user, depositoId: defaultDeposit.id });
    }
    
    alert(`✅ ${problemUsers.length} usuário(s) corrigido(s) com sucesso!\n\n⚠️ Aguarde 10 segundos para sincronização com a nuvem, depois recarregue a página (F5).`);
  }

  const handleEdit = (emp: Colaborador) => {
    setForm({
      ...emp,
      permissoes: emp.permissoes || [] // Ensure array
    });
    setIsModalOpen(true);
  };

  const togglePermission = (moduleId: string) => {
    const current = form.permissoes || [];
    if (current.includes(moduleId)) {
      setForm({ ...form, permissoes: current.filter(id => id !== moduleId) });
    } else {
      setForm({ ...form, permissoes: [...current, moduleId] });
    }
  };

  const toggleAllPermissions = () => {
    if (form.permissoes?.length === DASHBOARD_ITEMS.length) {
      setForm({ ...form, permissoes: [] });
    } else {
      setForm({ ...form, permissoes: DASHBOARD_ITEMS.map(i => i.id) });
    }
  };

  // -- Filter Logic --
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' ? true : e.cargo === roleFilter;
    const matchesStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? e.ativo : !e.ativo;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Gestão de Colaboradores</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Equipe & Performance</p>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Main List Area */}
        <div className="flex-1 flex flex-col bg-app overflow-hidden relative">
           
           {/* Toolbar */}
           <div className="p-6 pb-2 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <div className="flex gap-2 bg-surface p-1 rounded-xl border border-bdr shadow-sm overflow-x-auto">
                   {['ALL', 'GERENTE', 'ENTREGADOR', 'ATENDENTE', 'CAIXA'].map(role => (
                      <button
                        key={role}
                        onClick={() => setRoleFilter(role)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
                          roleFilter === role ? 'bg-indigo-600 text-white shadow-md' : 'text-txt-muted hover:bg-app hover:text-txt-main'
                        }`}
                      >
                         {role === 'ALL' ? 'Todos' : role}
                      </button>
                   ))}
                </div>

                <div className="flex gap-2 bg-surface p-1 rounded-xl border border-bdr shadow-sm">
                   <button onClick={() => setStatusFilter('ACTIVE')} className={`px-3 py-2 rounded-lg text-xs font-bold ${statusFilter === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'text-txt-muted'}`}>Ativos</button>
                   <button onClick={() => setStatusFilter('INACTIVE')} className={`px-3 py-2 rounded-lg text-xs font-bold ${statusFilter === 'INACTIVE' ? 'bg-red-100 text-red-700' : 'text-txt-muted'}`}>Inativos</button>
                   <button onClick={() => setStatusFilter('ALL')} className={`px-3 py-2 rounded-lg text-xs font-bold ${statusFilter === 'ALL' ? 'bg-gray-100 text-gray-700' : 'text-txt-muted'}`}>Todos</button>
                </div>
              </div>

                         <div className="flex gap-3 w-full md:w-auto">
                         <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface border border-bdr rounded-xl text-sm font-bold text-txt-main focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    />
                 </div>
                         <button 
                            onClick={handleFixUsersWithoutDeposit}
                   className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
                            title="Corrigir usuários sem depósito vinculado"
                 >
                    <BadgeCheck className="w-4 h-4" /> CORRIGIR
                 </button>
                         <button 
                            onClick={() => { setForm({ ativo: true, cargo: 'ENTREGADOR', depositoId: undefined, permissoes: [] }); setIsModalOpen(true); }}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-transform active:scale-95"
                 >
                    <UserPlus className="w-4 h-4" /> NOVO
                 </button>
              </div>
           </div>

           {/* Cards Grid */}
           <div className="flex-1 overflow-y-auto p-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {filteredEmployees.map(emp => (
                    <div 
                      key={emp.id}
                      onClick={() => handleSelectDriver(emp)}
                      className={`bg-surface border border-bdr rounded-2xl p-5 hover:shadow-lg transition-all group relative cursor-pointer ${selectedDriver?.id === emp.id ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''} ${!emp.ativo ? 'opacity-70' : ''}`}
                    >
                       <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black border-2 shadow-sm ${
                                !emp.ativo ? 'bg-gray-100 border-gray-200 text-gray-400' :
                                emp.cargo === 'ENTREGADOR' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                emp.cargo === 'GERENTE' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                'bg-blue-100 text-blue-600 border-blue-200'
                             }`}>
                                {emp.nome.substring(0,2).toUpperCase()}
                             </div>
                             <div>
                                <h3 className="font-bold text-txt-main leading-tight flex items-center gap-2">
                                  {emp.nome}
                                  {!emp.ativo && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded uppercase">Inativo</span>}
                                </h3>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase mt-1 inline-block ${
                                   !emp.ativo ? 'bg-gray-100 text-gray-500' :
                                   emp.cargo === 'ENTREGADOR' ? 'bg-orange-500 text-white' : 'bg-app text-txt-muted border border-bdr'
                                }`}>
                                   {emp.cargo}
                                </span>
                             </div>
                          </div>
                          <div>
                             {emp.ativo ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                             ) : (
                                <Ban className="w-5 h-5 text-red-500" />
                             )}
                          </div>
                       </div>

                       <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-xs text-txt-muted">
                             <MapPin className="w-3.5 h-3.5" />
                             <span className="font-medium truncate">{getDepositName(emp.depositoId, emp.cargo)}</span>
                          </div>
                          {emp.username && (
                             <div className="flex items-center gap-2 text-xs text-txt-muted">
                                <Shield className="w-3.5 h-3.5" />
                                <span className="font-mono bg-app px-1.5 rounded">{emp.username}</span>
                             </div>
                          )}
                       </div>

                       {/* Permissions Count Preview */}
                       <div className="flex items-center gap-1 text-[10px] font-bold text-txt-muted bg-app/50 p-2 rounded-lg">
                          <LayoutGrid className="w-3 h-3" />
                          <span>{emp.permissoes?.length || 0} módulos permitidos</span>
                       </div>

                       {/* Actions (visible on hover) */}
                       <div className="flex gap-2 border-t border-bdr pt-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {emp.ativo ? (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(emp); }}
                                className="flex-1 py-2 rounded-lg bg-app hover:bg-indigo-50 text-indigo-600 text-xs font-bold transition-colors"
                              >
                                Editar
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                className="p-2 rounded-lg bg-app hover:bg-red-50 text-red-500 transition-colors"
                                title="Desativar ou Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleReactivate(emp.id); }}
                              className="w-full py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100 transition-colors"
                            >
                              Reativar Acesso
                            </button>
                          )}
                       </div>

                       {emp.cargo === 'ENTREGADOR' && (
                          <div className="absolute top-5 right-5 text-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity">
                             <BadgeCheck className="w-5 h-5" />
                          </div>
                       )}
                    </div>
                 ))}
                 
                 {filteredEmployees.length === 0 && (
                    <div className="col-span-full py-12 text-center text-txt-muted">
                       <p className="font-bold">Nenhum colaborador encontrado com os filtros atuais.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Right Panel: Driver Performance (Slide Over) */}
        {selectedDriver && selectedDriver.cargo === 'ENTREGADOR' && driverStats && selectedDriver.ativo && (
           <div className="w-96 bg-surface border-l border-bdr flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 relative z-10">
              <div className="p-6 bg-indigo-600 text-white shrink-0 relative overflow-hidden">
                 <button onClick={() => setSelectedDriver(null)} className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-white text-indigo-600 flex items-center justify-center font-black text-xl border-4 border-indigo-400">
                       {selectedDriver.nome.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                       <h3 className="font-bold text-lg leading-tight">{selectedDriver.nome}</h3>
                       <div className="flex items-center gap-1 text-xs font-medium text-indigo-200 mt-1">
                          <Truck className="w-3 h-3" /> Motorista Oficial
                       </div>
                    </div>
                 </div>
                 <Truck className="absolute -right-6 -bottom-6 w-32 h-32 text-black/10 rotate-12" />
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-app p-4 rounded-xl border border-bdr text-center">
                       <span className="text-xs font-bold text-txt-muted uppercase">Hoje</span>
                       <p className="text-3xl font-black text-indigo-600">{driverStats.deliveriesToday}</p>
                       <span className="text-[10px] text-txt-muted">entregas</span>
                    </div>
                    <div className="bg-app p-4 rounded-xl border border-bdr text-center">
                       <span className="text-xs font-bold text-txt-muted uppercase">Mês</span>
                       <p className="text-3xl font-black text-txt-main">{driverStats.deliveriesMonth}</p>
                       <span className="text-[10px] text-txt-muted">acumulado</span>
                    </div>
                 </div>
              </div>
           </div>
        )}

      </div>

      {/* --- MODAL CREATE/EDIT --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-bdr overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="bg-app px-6 py-4 border-b border-bdr flex justify-between items-center shrink-0">
                 <h3 className="text-lg font-black text-txt-main flex items-center gap-2">
                    {form.id ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <UserPlus className="w-5 h-5 text-indigo-500" />}
                    {form.id ? 'Editar Colaborador' : 'Novo Colaborador'}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className="hover:bg-bdr p-1 rounded-full"><X className="w-5 h-5 text-txt-muted" /></button>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Basic Info */}
                    <div className="space-y-4">
                       <div>
                          <label className="text-xs font-black text-txt-muted uppercase ml-1">Nome Completo *</label>
                          <input 
                            type="text" 
                            value={form.nome || ''} 
                            onChange={e => setForm({...form, nome: e.target.value})}
                            className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: João da Silva"
                          />
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-xs font-black text-txt-muted uppercase ml-1">Cargo *</label>
                             <select 
                               value={form.cargo || 'ENTREGADOR'} 
                               onChange={e => setForm({...form, cargo: e.target.value as any})}
                               className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                             >
                                <option value="GERENTE">Gerente</option>
                                <option value="ENTREGADOR">Entregador</option>
                                <option value="ATENDENTE">Atendente</option>
                                <option value="CAIXA">Caixa</option>
                             </select>
                          </div>
                          <div>
                             <label className="text-xs font-black text-txt-muted uppercase ml-1">Telefone</label>
                             <input 
                               type="text" 
                               value={form.telefone || ''} 
                               onChange={e => setForm({...form, telefone: e.target.value})}
                               className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-indigo-500"
                               placeholder="(00) 00000-0000"
                             />
                          </div>
                       </div>

                                  <div>
                                     <label className="text-xs font-black text-txt-muted uppercase ml-1">
                                        Vínculo de Depósito {isGlobalRole(form.cargo) ? '' : '* (OBRIGATÓRIO)'}
                                     </label>
                                     {isGlobalRole(form.cargo) ? (
                                        <div className="w-full bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm font-bold text-indigo-600">
                                           🌐 Acesso Global (todos os depósitos). Este usuário pode operar em qualquer depósito.
                                        </div>
                                     ) : (
                                        <>
                                          <select 
                                             value={form.depositoId || ''} 
                                             onChange={e => {
                                               const newDepositId = e.target.value;
                                               console.log('🏭 Depósito selecionado:', newDepositId);
                                               setForm({...form, depositoId: newDepositId});
                                             }}
                                             className={`w-full bg-app border ${!form.depositoId ? 'border-red-500' : 'border-bdr'} rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-txt-main`}
                                             required
                                          >
                                              <option value="">⚠️ Selecione o depósito...</option>
                                              {deposits.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                                          </select>
                                          {!form.depositoId && (
                                            <p className="text-xs text-red-500 mt-1">
                                              ⚠️ Cargo {form.cargo} DEVE ter depósito vinculado!
                                            </p>
                                          )}
                                        </>
                                     )}
                                  </div>

                        {/* Credentials */}
                        <div className="bg-surface border border-bdr rounded-xl p-4 space-y-4 shadow-sm">
                           <h4 className="text-xs font-black text-txt-main uppercase flex items-center gap-2">
                              <Key className="w-4 h-4 text-orange-500" /> Acesso ao Sistema
                           </h4>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="text-[10px] font-bold text-txt-muted uppercase ml-1">Login</label>
                                 <input 
                                   type="text" 
                                   value={form.username || ''}
                                   onChange={e => setForm({...form, username: e.target.value})}
                                   className="w-full bg-app border border-bdr rounded-lg p-2 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-orange-500"
                                   placeholder="usuario"
                                   autoComplete="new-password"
                                 />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-txt-muted uppercase ml-1">Senha</label>
                                 <div className="relative">
                                    <input 
                                      type={showPassword ? "text" : "password"}
                                      value={form.password || ''}
                                      onChange={e => setForm({...form, password: e.target.value})}
                                      className="w-full bg-app border border-bdr rounded-lg p-2 pr-8 text-sm font-bold text-txt-main outline-none focus:ring-2 focus:ring-orange-500"
                                      placeholder="••••"
                                      autoComplete="new-password"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-2 top-2.5 text-txt-muted hover:text-txt-main"
                                    >
                                       {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                 </div>
                              </div>
                           </div>
                        </div>
                    </div>

                    {/* Column 2: Permissions */}
                    <div className="flex flex-col h-full">
                       <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-black text-txt-muted uppercase ml-1 flex items-center gap-2">
                             <LayoutGrid className="w-4 h-4" /> Permissões de Acesso
                          </label>
                          <button 
                            type="button" 
                            onClick={toggleAllPermissions}
                            className="text-[10px] font-bold text-indigo-600 hover:underline"
                          >
                             {form.permissoes?.length === DASHBOARD_ITEMS.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                          </button>
                       </div>
                       
                       <div className="flex-1 bg-app border border-bdr rounded-xl p-2 overflow-y-auto max-h-[400px]">
                          <div className="grid grid-cols-2 gap-2">
                             {DASHBOARD_ITEMS.map((item) => {
                                const isChecked = form.permissoes?.includes(item.id);
                                const Icon = item.icon;
                                return (
                                   <div 
                                     key={item.id}
                                     onClick={() => togglePermission(item.id)}
                                     className={`cursor-pointer flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                        isChecked 
                                          ? 'bg-white border-indigo-200 shadow-sm' 
                                          : 'bg-transparent border-transparent hover:bg-surface hover:border-bdr opacity-60'
                                     }`}
                                   >
                                      <div className={`transition-colors ${isChecked ? 'text-indigo-600' : 'text-txt-muted'}`}>
                                         {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                      </div>
                                      <div className="flex items-center gap-2 overflow-hidden">
                                         <div className={`p-1 rounded ${item.bgColor}`}>
                                            <Icon className={`w-3 h-3 ${item.color}`} />
                                         </div>
                                         <span className={`text-[10px] font-bold truncate ${isChecked ? 'text-txt-main' : 'text-txt-muted'}`}>
                                            {item.label}
                                         </span>
                                      </div>
                                   </div>
                                );
                             })}
                          </div>
                       </div>
                       <p className="text-[10px] text-txt-muted mt-2 ml-1">
                          Defina quais módulos aparecerão no menu principal para este usuário.
                       </p>
                    </div>
                 </div>

              </div>

              <div className="p-4 bg-app border-t border-bdr flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-txt-muted font-bold hover:bg-surface rounded-lg transition-colors">Cancelar</button>
                 <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    <Save className="w-4 h-4" /> SALVAR DADOS
                 </button>
              </div>

           </div>
        </div>
      )}

    </div>
  );
};



