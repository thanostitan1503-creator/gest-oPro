
import React, { useState, useEffect } from 'react';
import { 
  X, Truck, MapPin, Search, Clock, 
  User, CheckCircle2, AlertCircle, RefreshCw,
  ArrowRight, Filter, ChevronRight, Activity, WifiOff
} from 'lucide-react';
import { DeliveryJob, DriverPresence } from '../src/domain/types';
import { listDeliveryJobs } from '../src/domain/repositories/index';
import { assignJobToDriver, checkDeliveryTimeouts } from '../src/domain/delivery.logic';
import { getAllDriversStatus } from '../src/domain/driverPresence.logic';

interface DeliveryDispatchModuleProps {
  onClose: () => void;
}

export const DeliveryDispatchModule: React.FC<DeliveryDispatchModuleProps> = ({ onClose }) => {
  // Data
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [drivers, setDrivers] = useState<DriverPresence[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('AGUARDANDO');

  // Polling for updates
   useEffect(() => {
      let isMounted = true;

      const tick = async () => {
         await checkDeliveryTimeouts(); // Run logic to revert timed-out assignments
         const [jobsDb, driversDb] = await Promise.all([
            listDeliveryJobs(),
            getAllDriversStatus()
         ]);

         if (!isMounted) return;
         setJobs(jobsDb);
         setDrivers(driversDb);
         setLoading(false);
      };

      tick();
      const interval = setInterval(tick, 3000); // 3s fast refresh for dispatch
      return () => {
         isMounted = false;
         clearInterval(interval);
      };
   }, []);

  // Filter Jobs
  const filteredJobs = jobs.filter(j => {
    if (filterStatus === 'AGUARDANDO') return j.status === 'AGUARDANDO_DESPACHO' || j.status === 'FALHA_DEVOLVIDA';
    if (filterStatus === 'ATIVO') return ['ATRIBUIDA', 'ACEITA', 'EM_ROTA'].includes(j.status);
    if (filterStatus === 'CONCLUIDA') return j.status === 'ENTREGUE';
    return true;
  }).sort((a, b) => {
    // Sort logic: pending first, older first
    return (a.assignedAt || 0) - (b.assignedAt || 0); // Placeholder sort
  });

  const availableDrivers = drivers.filter(d => d.status === 'DISPONIVEL' && (Date.now() - d.lastSeenAt < 45000));

  const handleAssign = (driverId: string) => {
    if (!selectedJobId) return;
    if (confirm("Confirmar despacho para este entregador?")) {
         assignJobToDriver(selectedJobId, driverId).then(() => setSelectedJobId(null));
    }
  };

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
            <Truck className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Despacho de Entregas</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Controle de Frota em Tempo Real</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="text-xs font-mono text-txt-muted flex items-center gap-2 bg-app px-3 py-1 rounded-lg border border-bdr">
              {loading ? <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" /> : <Activity className="w-3 h-3 text-green-500 animate-pulse" />}
              {loading ? 'Sincronizando...' : 'Ao Vivo'}
           </div>
           <button onClick={onClose} className="p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Jobs Queue */}
        <div className="flex-1 flex flex-col border-r border-bdr bg-app/50">
           
           {/* Filters */}
           <div className="p-4 flex gap-2 border-b border-bdr bg-surface">
              {['AGUARDANDO', 'ATIVO', 'CONCLUIDA'].map(status => (
                 <button
                   key={status}
                   onClick={() => { setFilterStatus(status); setSelectedJobId(null); }}
                   className={`flex-1 py-2 text-xs font-black uppercase rounded-lg border transition-all ${filterStatus === status ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-app text-txt-muted border-bdr hover:bg-white'}`}
                 >
                    {status}
                 </button>
              ))}
           </div>

           {/* List */}
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredJobs.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-txt-muted opacity-50">
                    <Truck className="w-12 h-12 mb-2" />
                    <p className="font-bold text-sm">Nenhuma entrega nesta fila</p>
                 </div>
              )}

              {filteredJobs.map(job => (
                 <div 
                   key={job.id}
                   onClick={() => setSelectedJobId(job.id)}
                   className={`bg-surface p-4 rounded-xl border-2 transition-all cursor-pointer relative group ${selectedJobId === job.id ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' : 'border-bdr hover:border-indigo-300'}`}
                 >
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-black text-sm text-txt-main">#{job.osId.slice(0,8)}...</span>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          job.status === 'AGUARDANDO_DESPACHO' ? 'bg-amber-100 text-amber-700' :
                          job.status === 'ATRIBUIDA' ? 'bg-blue-100 text-blue-700' :
                          job.status === 'EM_ROTA' ? 'bg-purple-100 text-purple-700' :
                          job.status === 'FALHA_DEVOLVIDA' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                       }`}>
                          {job.status.replace('_', ' ')}
                       </span>
                    </div>
                    
                    <h3 className="font-bold text-base text-txt-main leading-tight mb-1">{job.customerName}</h3>
                    <p className="text-xs text-txt-muted flex items-center gap-1">
                       <MapPin className="w-3 h-3" /> {job.address.full}
                    </p>

                    <div className="mt-3 flex justify-between items-end border-t border-bdr pt-2">
                       <div>
                          <p className="text-[10px] text-txt-muted uppercase font-bold">Itens</p>
                          <p className="text-xs font-medium max-w-[150px] truncate">{job.itemsSummary}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">R$ {job.totalValue.toFixed(2)}</p>
                       </div>
                    </div>

                    {job.refusalReason && (
                       <div className="mt-2 bg-red-50 text-red-600 text-[10px] font-bold p-2 rounded border border-red-100">
                          Recusada: {job.refusalReason}
                       </div>
                    )}
                 </div>
              ))}
           </div>
        </div>

        {/* RIGHT: Drivers / Assignment */}
        <div className="w-96 bg-surface flex flex-col">
           <div className="p-4 border-b border-bdr bg-indigo-50/50">
              <h3 className="font-black text-sm text-indigo-900 uppercase tracking-widest mb-1">Entregadores</h3>
              <p className="text-xs text-indigo-700">Selecione uma entrega à esquerda para despachar.</p>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {drivers.map(d => {
                 const isOnline = Date.now() - d.lastSeenAt < 45000;
                 
                 return (
                    <div key={d.driverId} className="flex items-center justify-between p-3 rounded-xl border border-bdr bg-app">
                       <div className="flex items-center gap-3">
                          <div>
                             {!isOnline ? <WifiOff className="w-4 h-4 text-gray-400" /> : 
                              d.status === 'DISPONIVEL' ? <MapPin className="w-4 h-4 text-emerald-500" /> : 
                              <Truck className="w-4 h-4 text-blue-500" />}
                          </div>
                          <div>
                             <p className="font-bold text-sm text-txt-main">{d.driverName}</p>
                             <p className="text-[10px] text-txt-muted uppercase font-bold">
                                {isOnline ? d.status : 'OFFLINE'} • {Math.floor((Date.now() - d.lastSeenAt) / 1000)}s atrás
                             </p>
                          </div>
                       </div>

                       {/* Action Button */}
                       {selectedJobId && isOnline && d.status === 'DISPONIVEL' && (
                          <button 
                            onClick={() => handleAssign(d.driverId)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-transform active:scale-95"
                          >
                             Enviar <ArrowRight className="w-3 h-3" />
                          </button>
                       )}
                    </div>
                 );
              })}

              {drivers.length === 0 && (
                 <p className="text-center text-xs text-txt-muted py-10">Nenhum entregador cadastrado.</p>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};
