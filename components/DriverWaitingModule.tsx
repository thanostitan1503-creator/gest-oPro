
import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, WifiOff, Coffee, Bike, MapPin, 
  Power, BellRing, DollarSign, Package,
  CheckCircle2, XCircle
} from 'lucide-react';
import { Colaborador, DeliveryJob, DriverStatus } from '../domain/types';
import { listDeliveryJobs } from '../src/domain_old/repositories';
import { updateDriverHeartbeat } from '../domain/driverPresence.logic';
import { acceptJob, refuseJob } from '../domain/delivery.logic';

// Som de Bip Digital (Curto e Alto)
const ALERT_SOUND = "data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

interface DriverWaitingModuleProps {
  currentUser: Colaborador;
  onJobStart: () => void;
}

export const DriverWaitingModule: React.FC<DriverWaitingModuleProps> = ({ currentUser, onJobStart }) => {
  const [incomingJob, setIncomingJob] = useState<DeliveryJob | null>(null);
  const [isOnline, setIsOnline] = useState(false); // Começa offline para forçar interação
  const [lastPing, setLastPing] = useState(Date.now());
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializa o elemento de áudio
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND);
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0;
  }, []);

  // Polling de Jobs e Heartbeat
  useEffect(() => {
    if (!isOnline) return;

    const checkJobs = async () => {
      // 1. Enviar batimento cardíaco (estou vivo e disponível)
      const status: DriverStatus = incomingJob ? 'OCUPADO' : 'DISPONIVEL';
      await updateDriverHeartbeat(currentUser, undefined, undefined, status);
      setLastPing(Date.now());

      // 2. Verificar se tem job atribuído especificamente para mim
      const jobs = await listDeliveryJobs();
      const myJob = jobs.find(j => j.assignedDriverId === currentUser.id && j.status === 'ATRIBUIDA');

      if (myJob) {
        if (!incomingJob || incomingJob.id !== myJob.id) {
           setIncomingJob(myJob);
           // Tocar som se não estiver tocando
           if (audioRef.current) {
             audioRef.current.play().catch(e => console.log("Áudio bloqueado pelo navegador", e));
           }
           // Vibrar celular se suportado
           if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        }
      } else {
        setIncomingJob(null);
        // Parar som se não tiver job
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    };

    const interval = setInterval(() => { void checkJobs(); }, 3000); // Checa a cada 3s
    void checkJobs(); // Checa imediatamente

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [isOnline, currentUser, incomingJob]);

  // Handlers
  const handleAccept = () => {
    if (!incomingJob) return;
    
    if (audioRef.current) audioRef.current.pause();

    acceptJob(incomingJob.id, currentUser).then((updated) => {
      if (updated) {
      onJobStart(); 
      } else {
        alert("Erro ao aceitar. A entrega pode ter sido cancelada.");
        setIncomingJob(null);
      }
    });
  };

  const handleRefuse = () => {
    if (!incomingJob) return;
    
    if (confirm("Recusar esta corrida? Ela voltará para a fila.")) {
      refuseJob(incomingJob.id, currentUser.id, "Recusa manual no app").then(() => setIncomingJob(null));
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  const toggleOnline = () => {
    if (!isOnline) {
      // Going Online -> Unlock Audio
      if (audioRef.current) {
        // Toca e pausa rapidamente para o navegador liberar o áudio
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
        }).catch(e => console.log("Erro ao desbloquear áudio:", e));
      }
      setIsOnline(true);
    } else {
      // Going Offline
      updateDriverHeartbeat(currentUser, undefined, undefined, 'OFFLINE').finally(() => setIsOnline(false));
    }
  };

  // --- RENDER: TELA DE CHAMADO (INCOMING JOB) ---
  if (incomingJob) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col animate-in slide-in-from-bottom duration-300">
        
        {/* Pisca Alerta Vermelho */}
        <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none z-0"></div>

        <div className="relative z-10 flex-1 flex flex-col p-6">
          
          <div className="bg-red-600 rounded-2xl p-4 shadow-lg shadow-red-900/50 mb-6 text-center animate-bounce">
            <h2 className="text-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">
              <BellRing className="w-8 h-8" /> Nova Entrega!
            </h2>
          </div>

          <div className="flex-1 bg-slate-800 rounded-3xl border border-slate-700 p-6 flex flex-col gap-6 shadow-2xl overflow-y-auto">
            
            {/* Endereço */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Destino</label>
              <div className="flex gap-3">
                <MapPin className="w-8 h-8 text-red-500 shrink-0 mt-1" />
                <div>
                  <p className="text-xl font-bold leading-tight text-white">{incomingJob.address.full}</p>
                  <p className="text-sm text-slate-400 mt-1">{incomingJob.customerName}</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-700" />

            {/* Resumo Pedido */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-xl">
                <Package className="w-5 h-5 text-indigo-400 mb-2" />
                <p className="text-xs text-slate-400 uppercase font-bold">Produtos</p>
                <p className="font-bold text-sm text-indigo-100">{incomingJob.itemsSummary}</p>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-xl">
                <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
                <p className="text-xs text-slate-400 uppercase font-bold">A Receber</p>
                <p className="font-black text-xl text-emerald-400">R$ {incomingJob.totalValue.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl">
               <p className="text-xs text-slate-400 uppercase font-bold mb-1">Forma de Pagamento</p>
               <p className="font-bold text-white text-lg">{incomingJob.paymentMethod}</p>
            </div>

          </div>

          {/* Botões de Ação */}
          <div className="mt-6 flex flex-col gap-3">
            <button 
              onClick={handleAccept}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all rounded-2xl font-black text-xl uppercase shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-8 h-8" /> ACEITAR CORRIDA
            </button>
            <button 
              onClick={handleRefuse}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all rounded-2xl font-bold text-slate-300 uppercase flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" /> Recusar
            </button>
          </div>

        </div>
      </div>
    );
  }

  // --- RENDER: TELA DE ESPERA (RADAR) ---
  return (
    <div className="h-full bg-slate-950 flex flex-col text-slate-200">
      
      {/* Top Status */}
      <div className="px-6 py-8 flex flex-col items-center justify-center border-b border-slate-900 bg-slate-900/50">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${isOnline ? 'bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-slate-800'}`}>
          {isOnline ? (
            <div className="relative">
              <Wifi className="w-10 h-10 text-emerald-500 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping"></div>
            </div>
          ) : (
            <WifiOff className="w-10 h-10 text-slate-500" />
          )}
        </div>
        
        <h2 className="text-xl font-bold text-white mb-1">
          {isOnline ? 'Aguardando Chamados...' : 'Você está Offline'}
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          {isOnline ? 'Fique atento ao alerta sonoro' : 'Ative para receber entregas'}
        </p>
      </div>

      {/* Main Illustration */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {isOnline ? (
          <div className="relative w-64 h-64">
            {/* Radar Rings */}
            <div className="absolute inset-0 border border-emerald-500/20 rounded-full animate-[ping_3s_linear_infinite]"></div>
            <div className="absolute inset-4 border border-emerald-500/30 rounded-full animate-[ping_3s_linear_infinite_1s]"></div>
            <div className="absolute inset-12 border border-emerald-500/10 rounded-full"></div>
            
            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
               <Bike className="w-16 h-16 text-slate-600 opacity-50" />
            </div>
            
            {/* Scanning Line */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-emerald-500/20 to-transparent w-full h-1/2 top-1/2 origin-top animate-spin-slow opacity-30 pointer-events-none"></div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-600 gap-4">
             <Coffee className="w-20 h-20 opacity-20" />
             <p className="font-medium text-sm">Modo Pausa Ativo</p>
          </div>
        )}
      </div>

      {/* Footer Toggle */}
      <div className="p-6 bg-slate-900 border-t border-slate-800">
        <button 
          onClick={toggleOnline}
          className={`w-full py-4 rounded-xl font-black text-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${
            isOnline 
              ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' 
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          <Power className="w-6 h-6" />
          {isOnline ? 'FICAR OFFLINE' : 'INICIAR TURNO'}
        </button>
        <p className="text-center text-[10px] text-slate-600 mt-4 font-mono">
          Última conexão: {new Date(lastPing).toLocaleTimeString()}
        </p>
      </div>

    </div>
  );
};
