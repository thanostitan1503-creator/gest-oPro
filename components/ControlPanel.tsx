
import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Factory, 
  Package, 
  CreditCard, 
  FileText, 
  Siren, 
  FileClock,
  Settings,
  Lock,
  ChevronRight,
  ShieldCheck,
  Wallet,
  Truck,
  AlertOctagon,
  Trash2
} from 'lucide-react';
import { performFactoryReset } from '../domain/storage';

interface ControlPanelProps {
  onClose: () => void;
  onNavigate?: (module: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ onClose, onNavigate }) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetAcknowledged, setIsResetAcknowledged] = useState(false);
  
  const handleNavigation = (module: string) => {
    if (onNavigate) {
      onNavigate(module);
    }
  };

  const handleFactoryReset = () => {
    if (resetConfirmText !== 'RESETAR TUDO' || !isResetAcknowledged) return;
    performFactoryReset();
    window.location.reload(); // Recarrega para iniciar fluxo de setup
  };

  // Componente de Botão de Ação Rápida (Redesenhado)
  const ActionButton = ({ icon: Icon, title, desc, onClick, colorClass = "text-primary" }: any) => (
    <button 
      onClick={onClick}
      className="relative group w-full flex items-center justify-between p-6 bg-surface border border-bdr rounded-2xl hover:border-primary/50 hover:shadow-xl transition-all duration-300 overflow-hidden text-left"
    >
      <div className="z-10 flex flex-col gap-3 max-w-[75%]">
        {/* Cabeçalho do Botão */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-app border border-bdr ${colorClass} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-black text-txt-main text-sm uppercase tracking-wide group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>
        
        <p className="text-xs text-txt-muted font-medium leading-relaxed pl-1">
          {desc}
        </p>
      </div>

      {/* Ícone Grande na Direita (Substitui o quadrado) */}
      <div className={`absolute -right-6 top-1/2 -translate-y-1/2 opacity-5 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 group-hover:-rotate-12 duration-500 ${colorClass}`}>
         <Icon className="w-32 h-32" />
      </div>
      
      {/* Seta indicativa que aparece no hover */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
        <div className="bg-app p-2 rounded-full border border-bdr shadow-sm">
           <ChevronRight className={`w-5 h-5 ${colorClass}`} />
        </div>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
      {/* Main Window */}
      <div className="bg-app w-full h-full max-w-[1400px] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-bdr">
        
        {/* Header */}
        <div className="bg-surface border-b border-bdr px-8 py-6 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black text-txt-main tracking-tight flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary animate-spin-slow" />
              Painel de Controle
            </h2>
            <p className="text-sm text-txt-muted font-bold mt-1">Central Administrativa & Configurações do Sistema</p>
          </div>
          <button 
            onClick={onClose} 
            className="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-bdr hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all text-txt-muted font-bold text-xs uppercase tracking-widest"
          >
            <span>Fechar Painel</span>
            <div className="bg-txt-muted group-hover:bg-red-500 w-5 h-5 rounded-full flex items-center justify-center text-white transition-colors">
              <X className="w-3 h-3" />
            </div>
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-app">
          <div className="max-w-7xl mx-auto space-y-12">
            
            {/* SECTION 1: ESTRUTURA E ACESSOS */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 border-b border-bdr pb-2">
                <ShieldCheck className="w-4 h-4" />
                Estrutura & Acessos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionButton 
                  icon={Users} 
                  title="Colaboradores" 
                  desc="Gerencie acessos, logins e permissões de usuários por depósito."
                  onClick={() => handleNavigation('colaboradores')}
                  colorClass="text-blue-500"
                />
              </div>
            </div>

            {/* SECTION 2: FINANCEIRO E VENDAS */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 border-b border-bdr pb-2">
                <Wallet className="w-4 h-4" />
                Financeiro & Regras de Venda
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionButton
                  icon={CreditCard}
                  title="Formas de Pagamento & Máquinas"
                  desc="Cadastre taxas de maquininhas, prazos de recebimento e métodos aceitos."
                  onClick={() => handleNavigation('sales-modalities')}
                  colorClass="text-emerald-500"
                />
                <ActionButton
                  icon={FileText}
                  title="Modalidades de Venda"
                  desc="Configure regras para Venda, Troca, Casco e como movimentam o estoque."
                  onClick={() => handleNavigation('transaction-modalities')}
                  colorClass="text-teal-500"
                />
                <ActionButton
                  icon={Truck}
                  title="Taxas de Entrega"
                  desc="Defina zonas, bairros e valores de taxa de entrega por deposito."
                  onClick={() => handleNavigation('delivery-settings')}
                  colorClass="text-orange-500"
                />
              </div>
            </div>

            {/* SECTION 3: AUDITORIA E SISTEMA */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 border-b border-bdr pb-2">
                <Lock className="w-4 h-4" />
                Segurança & Logs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionButton 
                  icon={Siren} 
                  title="Centro de Alertas" 
                  desc="Ative ou desative notificações financeiras e operacionais."
                  onClick={() => handleNavigation('alertas')}
                  colorClass="text-orange-500"
                />
                <ActionButton 
                  icon={FileClock} 
                  title="Auditoria Completa" 
                  desc="Visualize o log detalhado de todas as ações realizadas no sistema."
                  onClick={() => handleNavigation('auditoria')}
                  colorClass="text-amber-500"
                />
                
                {/* RESET BUTTON ESPECIAL */}
                <button 
                  onClick={() => setShowResetModal(true)}
                  className="group relative flex flex-col items-center justify-center p-6 bg-red-50 border-2 border-red-100 rounded-2xl hover:bg-red-600 hover:border-red-600 transition-all duration-300 text-center overflow-hidden"
                >
                   <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-20 text-white transition-opacity transform translate-x-4 -translate-y-4">
                      <AlertOctagon className="w-32 h-32" />
                   </div>

                   <div className="bg-red-200 text-red-600 group-hover:bg-white group-hover:text-red-600 p-4 rounded-full mb-3 transition-colors z-10 shadow-sm">
                      <AlertOctagon className="w-8 h-8" />
                   </div>
                   <h3 className="font-black text-red-700 group-hover:text-white text-sm uppercase tracking-widest mb-1 z-10 transition-colors">
                      Reset Geral
                   </h3>
                   <p className="text-xs text-red-500 group-hover:text-red-100 leading-tight px-4 z-10 font-medium transition-colors">
                      Apagar todos os dados e reiniciar o sistema
                   </p>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer info */}
        <div className="bg-app border-t border-bdr p-4 text-center">
          <p className="text-[10px] text-txt-muted font-bold uppercase tracking-widest opacity-60">
            Sistema Versão 2.5.0 • Acesso Administrativo Concedido
          </p>
        </div>

      </div>

      {/* MODAL RESET CONFIRMATION */}
      {showResetModal && (
        <div className="fixed inset-0 bg-red-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 border-4 border-red-600 text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-2 animate-bounce">
                 <AlertOctagon className="w-10 h-10 text-red-600" />
              </div>
              
              <div>
                 <h2 className="text-3xl font-black text-red-700 mb-2">PERIGO!</h2>
                 <p className="text-gray-600 font-medium">
                    Esta ação irá <strong>APAGAR TODOS OS DADOS</strong> do sistema: Estoque, Vendas, Clientes, Colaboradores e Configurações.
                 </p>
                 <p className="text-red-600 font-bold text-sm mt-2 uppercase bg-red-50 inline-block px-3 py-1 rounded">Esta ação é irreversível.</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl text-left space-y-3 border border-gray-200 shadow-inner">
                 <label className="block text-xs font-bold text-gray-500 uppercase">Digite <span className="text-red-600">RESETAR TUDO</span> para confirmar:</label>
                 <input 
                   type="text"
                   value={resetConfirmText}
                   onChange={(e) => setResetConfirmText(e.target.value)}
                   className="w-full border-2 border-gray-300 rounded-lg p-3 font-black text-red-600 focus:border-red-600 outline-none uppercase placeholder:text-gray-300"
                   placeholder="RESETAR TUDO"
                 />
                 
                 <label className="flex items-center gap-3 cursor-pointer mt-2 select-none">
                    <input 
                      type="checkbox" 
                      checked={isResetAcknowledged}
                      onChange={(e) => setIsResetAcknowledged(e.target.checked)}
                      className="w-5 h-5 accent-red-600"
                    />
                    <span className="text-sm font-bold text-gray-700">Entendo que perderei todos os dados.</span>
                 </label>
              </div>

              <div className="flex gap-4">
                 <button 
                   onClick={() => setShowResetModal(false)}
                   className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                   onClick={handleFactoryReset}
                   disabled={resetConfirmText !== 'RESETAR TUDO' || !isResetAcknowledged}
                   className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
                 >
                    <Trash2 className="w-5 h-5" /> APAGAR TUDO
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
