
import React, { useState, useEffect } from 'react';
import { 
  MapPin, Phone, User, CheckCircle2, Navigation, AlertTriangle, 
  ChevronRight, Package, DollarSign, ArrowLeft
} from 'lucide-react';
import { Colaborador, DeliveryJob } from '@/domain/types';
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
// ⚠️ REMOVIDO v3.0: import { updateDriverHeartbeat } from '@/domain/driverPresence.logic';
// ⚠️ REMOVIDO v3.0: import { completeJob, returnJob } from '@/domain/delivery.logic';

interface DriverCurrentDeliveryModuleProps {
  currentUser: Colaborador;
  onJobFinished: () => void; // Callback to go back to waiting
}

export const DriverCurrentDeliveryModule: React.FC<DriverCurrentDeliveryModuleProps> = ({ currentUser, onJobFinished }) => {
  const [job, setJob] = useState<DeliveryJob | null>(null);

  // Poll for job status updates (in case admin cancels)
   useEffect(() => {
      let isMounted = true;

      const fetchJob = async () => {
         const myJobs = await listDeliveryJobsByDriver(currentUser.id);
         // Novo fluxo: motorista só vê entregas EM_ROTA atribuídas a ele
         const activeJob = myJobs.find(j => j.status === 'EM_ROTA');
      
         if (!isMounted) return;

         if (!activeJob) {
            onJobFinished(); // Job gone (cancelled or re-assigned)
         } else {
            setJob(activeJob);
            // Keep heartbeat alive as OCUPADO
            await updateDriverHeartbeat(currentUser, undefined, undefined, 'OCUPADO');
         }
      };

      fetchJob();
      const interval = setInterval(() => { void fetchJob(); }, 5000);
      return () => { isMounted = false; clearInterval(interval); };
   }, [currentUser, onJobFinished]);

  if (!job) return <div className="p-10 text-center text-white">Carregando dados da entrega...</div>;

   const handleComplete = () => {
      if (confirm("Confirmar entrega realizada e recebimento do valor?")) {
         completeJob(job.id).then(() => onJobFinished());
      }
   };

   const handleFail = () => {
      const reason = prompt("Motivo da devolução/falha:");
      if (reason) {
         returnJob(job.id, reason).then(() => onJobFinished());
      }
   };

  const openMaps = () => {
    const query = encodeURIComponent(job.address.full + ", Rio Verde - GO");
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden relative">
      
      {/* Map Placeholder / Header Background */}
      <div className="h-1/3 bg-slate-800 relative w-full overflow-hidden">
         <div className="absolute inset-0 opacity-30 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/OpenStreetMap_Logo.png')] bg-cover bg-center grayscale mix-blend-overlay"></div>
         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950"></div>
         
         {/* Status Pill - Simplificado: só mostra EM_ROTA */}
         <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-500 animate-pulse" />
            Em Deslocamento
         </div>
      </div>

      {/* Content Card (Slide Up) */}
      <div className="flex-1 bg-slate-900 rounded-t-[2rem] -mt-10 relative z-10 flex flex-col p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-slate-800">
         
         <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6 opacity-50" />

         {/* Customer Info */}
         <div className="space-y-6 flex-1 overflow-y-auto pb-4">
            
            <div className="flex justify-between items-start">
               <div>
                  <h2 className="text-2xl font-black leading-tight mb-1">{job.customerName}</h2>
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm" onClick={() => window.open(`tel:${job.customerPhone}`)}>
                     <Phone className="w-4 h-4" /> {job.customerPhone || 'Sem telefone'}
                  </div>
               </div>
               <div className="text-right">
                  <div className="text-xs text-slate-500 font-bold uppercase">Total a Receber</div>
                  <div className="text-2xl font-black text-emerald-400">R$ {job.totalValue.toFixed(2)}</div>
               </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex gap-4">
               <MapPin className="w-6 h-6 text-indigo-500 shrink-0 mt-1" />
               <div>
                  <p className="text-sm font-medium text-slate-200 leading-snug">{job.address.full}</p>
               </div>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Pagamento</span>
                  <span className="font-bold">{job.paymentMethod}</span>
               </div>
               <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Itens</span>
                  <span className="font-bold text-right max-w-[200px] truncate">{job.itemsSummary}</span>
               </div>
               {job.observation && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200">
                     <span className="font-bold block mb-1">Observação:</span>
                     {job.observation}
                  </div>
               )}
            </div>

         </div>

         {/* Actions - Simplificado: motorista só completa ou reporta problema */}
         <div className="mt-4 space-y-3">
            <div className="grid grid-cols-4 gap-3">
               <button 
                 onClick={openMaps}
                 className="col-span-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center py-4"
               >
                  <Navigation className="w-6 h-6" />
               </button>
               <button 
                 onClick={handleComplete}
                 className="col-span-3 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-base shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
               >
                  <CheckCircle2 className="w-5 h-5" /> FINALIZAR
               </button>
            </div>
            
            <button 
               onClick={handleFail}
               className="w-full py-3 text-xs font-bold text-slate-500 hover:text-red-500 transition-colors"
            >
               Relatar Problema / Devolver
            </button>
         </div>

      </div>
    </div>
  );
};



