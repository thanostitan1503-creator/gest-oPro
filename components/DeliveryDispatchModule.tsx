
import React, { useState, useEffect } from 'react';
import { 
  X, Truck, MapPin, Search, Clock, 
  User, CheckCircle2, AlertCircle, RefreshCw,
  ArrowRight, Filter, ChevronRight, Activity, WifiOff,
  Play, CheckCheck, RotateCcw, XCircle
} from 'lucide-react';
import { DeliveryJob, DriverPresence, DeliveryStatus } from '@/domain/types';
import { listDeliveryJobs } from '@/domain/repositories/index';
import { startRoute, completeJob, returnJob, cancelJob } from '@/domain/delivery.logic';
import { getAllDriversStatus } from '@/domain/driverPresence.logic';

interface DeliveryDispatchModuleProps {
  onClose: () => void;
}

/**
 * Módulo de Despacho de Entregas
 * 
 * Fluxo simplificado (v2.0):
 * CRIADA → PENDENTE_ENTREGA → EM_ROTA → CONCLUIDA | DEVOLVIDA | CANCELADA
 * 
 * Ações do operador:
 * - "Iniciar Rota": PENDENTE_ENTREGA → EM_ROTA
 * - "Concluir": EM_ROTA → CONCLUIDA
 * - "Devolver": EM_ROTA → DEVOLVIDA
 * - "Cancelar": Qualquer status → CANCELADA
 */
export const DeliveryDispatchModule: React.FC<DeliveryDispatchModuleProps> = ({ onClose }) => {
  // Data
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [drivers, setDrivers] = useState<DriverPresence[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'PENDENTE' | 'EM_ROTA' | 'FINALIZADO'>('PENDENTE');

  // Polling for updates
   useEffect(() => {
      let isMounted = true;

      const tick = async () => {
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

  // Filter Jobs - Usando o novo fluxo simplificado
  const filteredJobs = jobs.filter(j => {
    if (filterStatus === 'PENDENTE') return j.status === 'PENDENTE_ENTREGA' || j.status === 'DEVOLVIDA';
    if (filterStatus === 'EM_ROTA') return j.status === 'EM_ROTA';
    if (filterStatus === 'FINALIZADO') return j.status === 'CONCLUIDA' || j.status === 'CANCELADA';
    return true;
  }).sort((a, b) => {
    // Sort logic: pending first, older first
    return (a.assignedAt || 0) - (b.assignedAt || 0);
  });

  const availableDrivers = drivers.filter(d => d.status === 'DISPONIVEL' && (Date.now() - d.lastSeenAt < 45000));

  // Ações do novo fluxo
  const handleStartRoute = async (jobId: string, driverId: string) => {
    if (confirm("Iniciar entrega com este entregador?")) {
      await startRoute(jobId, driverId);
      setSelectedJobId(null);
    }
  };

  const handleComplete = async (jobId: string) => {
    if (confirm("Confirmar entrega realizada?")) {
      await completeJob(jobId);
      setSelectedJobId(null);
    }
  };

  const handleReturn = async (jobId: string, reason: string) => {
    if (confirm("Confirmar devolução da entrega?")) {
      await returnJob(jobId, reason);
      setSelectedJobId(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (confirm("Cancelar esta entrega? Esta ação não pode ser desfeita.")) {
      await cancelJob(jobId);
      setSelectedJobId(null);
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
           
           {/* Filters - Novo fluxo simplificado */}
           <div className="p-4 flex gap-2 border-b border-bdr bg-surface">
              {(['PENDENTE', 'EM_ROTA', 'FINALIZADO'] as const).map(status => (
                 <button
                   key={status}
                   onClick={() => { setFilterStatus(status); setSelectedJobId(null); }}
                   className={`flex-1 py-2 text-xs font-black uppercase rounded-lg border transition-all ${filterStatus === status ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-app text-txt-muted border-bdr hover:bg-white'}`}
                 >
                    {status === 'PENDENTE' ? 'PENDENTE' : status === 'EM_ROTA' ? 'EM ROTA' : 'FINALIZADO'}
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
                          job.status === 'PENDENTE_ENTREGA' ? 'bg-amber-100 text-amber-700' :
                          job.status === 'EM_ROTA' ? 'bg-blue-100 text-blue-700' :
                          job.status === 'DEVOLVIDA' ? 'bg-red-100 text-red-700' :
                          job.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' :
                          job.status === 'CANCELADA' ? 'bg-gray-100 text-gray-700' :
                          'bg-purple-100 text-purple-700'
                       }`}>
                          {job.status === 'PENDENTE_ENTREGA' ? 'PENDENTE' : job.status.replace('_', ' ')}
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

        {/* RIGHT: Drivers / Actions */}
        <div className="w-96 bg-surface flex flex-col">
           <div className="p-4 border-b border-bdr bg-indigo-50/50">
              <h3 className="font-black text-sm text-indigo-900 uppercase tracking-widest mb-1">Ações de Entrega</h3>
              <p className="text-xs text-indigo-700">Selecione uma entrega à esquerda para gerenciar.</p>
           </div>

           {/* Selected Job Actions */}
           {selectedJobId && (() => {
              const selectedJob = jobs.find(j => j.id === selectedJobId);
              if (!selectedJob) return null;

              return (
                 <div className="p-4 space-y-4">
                    {/* Job Info */}
                    <div className="bg-app p-4 rounded-xl border border-bdr">
                       <h4 className="font-bold text-txt-main mb-2">{selectedJob.customerName}</h4>
                       <p className="text-xs text-txt-muted mb-2">{selectedJob.address.full}</p>
                       <p className="text-lg font-black text-emerald-600">R$ {selectedJob.totalValue.toFixed(2)}</p>
                    </div>

                    {/* Actions based on status */}
                    {selectedJob.status === 'PENDENTE_ENTREGA' && (
                       <>
                          <p className="text-xs font-bold text-txt-muted uppercase">Selecione um entregador:</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                             {availableDrivers.map(d => (
                                <button
                                   key={d.driverId}
                                   onClick={() => handleStartRoute(selectedJobId, d.driverId)}
                                   className="w-full flex items-center justify-between p-3 rounded-lg border border-bdr bg-app hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                                >
                                   <span className="font-bold text-sm">{d.driverName}</span>
                                   <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                      Iniciar Rota <Play className="w-3 h-3" />
                                   </span>
                                </button>
                             ))}
                             {availableDrivers.length === 0 && (
                                <p className="text-xs text-txt-muted text-center py-4">Nenhum entregador disponível</p>
                             )}
                          </div>
                          <button
                             onClick={() => handleCancel(selectedJobId)}
                             className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                             <XCircle className="w-4 h-4" /> Cancelar Entrega
                          </button>
                       </>
                    )}

                    {selectedJob.status === 'EM_ROTA' && (
                       <div className="space-y-3">
                          <p className="text-xs font-bold text-txt-muted uppercase mb-2">
                             Entregador: {selectedJob.driverName || 'Não atribuído'}
                          </p>
                          <button
                             onClick={() => handleComplete(selectedJobId)}
                             className="w-full py-3 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                          >
                             <CheckCheck className="w-5 h-5" /> Confirmar Entrega
                          </button>
                          <button
                             onClick={() => {
                                const reason = prompt("Motivo da devolução:");
                                if (reason) handleReturn(selectedJobId, reason);
                             }}
                             className="w-full py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
                          >
                             <RotateCcw className="w-4 h-4" /> Devolver (Falha na Entrega)
                          </button>
                          <button
                             onClick={() => handleCancel(selectedJobId)}
                             className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                             <XCircle className="w-4 h-4" /> Cancelar
                          </button>
                       </div>
                    )}

                    {selectedJob.status === 'DEVOLVIDA' && (
                       <div className="space-y-3">
                          {selectedJob.refusalReason && (
                             <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg border border-red-100">
                                Motivo: {selectedJob.refusalReason}
                             </div>
                          )}
                          <p className="text-xs font-bold text-txt-muted uppercase">Reenviar para entrega:</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                             {availableDrivers.map(d => (
                                <button
                                   key={d.driverId}
                                   onClick={() => handleStartRoute(selectedJobId, d.driverId)}
                                   className="w-full flex items-center justify-between p-3 rounded-lg border border-bdr bg-app hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                                >
                                   <span className="font-bold text-sm">{d.driverName}</span>
                                   <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                      Reenviar <Play className="w-3 h-3" />
                                   </span>
                                </button>
                             ))}
                          </div>
                          <button
                             onClick={() => handleCancel(selectedJobId)}
                             className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                             <XCircle className="w-4 h-4" /> Cancelar Definitivamente
                          </button>
                       </div>
                    )}

                    {(selectedJob.status === 'CONCLUIDA' || selectedJob.status === 'CANCELADA') && (
                       <div className="text-center py-8 text-txt-muted">
                          <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-bold">Esta entrega já foi finalizada</p>
                       </div>
                    )}
                 </div>
              );
           })()}

           {/* No selection message */}
           {!selectedJobId && (
              <div className="flex-1 flex flex-col items-center justify-center text-txt-muted p-8">
                 <Truck className="w-16 h-16 mb-4 opacity-20" />
                 <p className="text-sm font-bold text-center">Selecione uma entrega na lista para ver as opções</p>
              </div>
           )}

           {/* Drivers Status Footer */}
           <div className="mt-auto border-t border-bdr p-4 bg-app">
              <p className="text-xs font-bold text-txt-muted uppercase mb-2">Entregadores Online</p>
              <div className="flex flex-wrap gap-2">
                 {drivers.filter(d => Date.now() - d.lastSeenAt < 45000).map(d => (
                    <span key={d.driverId} className={`text-xs px-2 py-1 rounded-full font-bold ${d.status === 'DISPONIVEL' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                       {d.driverName}
                    </span>
                 ))}
                 {drivers.filter(d => Date.now() - d.lastSeenAt < 45000).length === 0 && (
                    <span className="text-xs text-txt-muted">Nenhum online</span>
                 )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
