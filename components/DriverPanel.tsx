
import React, { useState, useEffect } from 'react';
import { Colaborador, DeliveryJob } from '../src/domain/types';
import { listDeliveryJobsByDriver } from '../src/domain/repositories/index';
import { DriverWaitingModule } from './DriverWaitingModule';
import { DriverCurrentDeliveryModule } from './DriverCurrentDeliveryModule';
import { LogOut } from 'lucide-react';

interface DriverPanelProps {
  currentUser: Colaborador;
  onLogout: () => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({ currentUser, onLogout }) => {
  const [view, setView] = useState<'WAITING' | 'ACTIVE'>('WAITING');

  // Initial check to see if driver already has an active job (recovery)
   useEffect(() => {
      const checkActive = async () => {
         const jobs = await listDeliveryJobsByDriver(currentUser.id);
         const active = jobs.find(j => j.status === 'ACEITA' || j.status === 'EM_ROTA');
         if (active) {
            setView('ACTIVE');
         }
      };

      checkActive();
   }, [currentUser]);

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col">
      {/* Header Fixo Mínimo */}
      <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800 shrink-0 z-50">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
               {currentUser.nome.substring(0,2).toUpperCase()}
            </div>
            <span className="font-bold text-slate-200 text-sm">{currentUser.nome}</span>
         </div>
         <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
         </button>
      </div>

      <div className="flex-1 relative">
         {view === 'WAITING' ? (
            <DriverWaitingModule 
               currentUser={currentUser} 
               onJobStart={() => setView('ACTIVE')} 
            />
         ) : (
            <DriverCurrentDeliveryModule 
               currentUser={currentUser} 
               onJobFinished={() => setView('WAITING')} 
            />
         )}
      </div>
    </div>
  );
};
