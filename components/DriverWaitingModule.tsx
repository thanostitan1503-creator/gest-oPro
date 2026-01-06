
import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, WifiOff, Coffee, Bike, MapPin, 
  Power, BellRing, DollarSign, Package,
  CheckCircle2, XCircle
} from 'lucide-react';
import { Colaborador, DeliveryJob, DriverStatus } from '@/domain/types';
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
// ⚠️ REMOVIDO v3.0: import { updateDriverHeartbeat } from '@/domain/driverPresence.logic';

// Som de Bip Digital (Curto e Alto)
const ALERT_SOUND = "data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

interface DriverWaitingModuleProps {
  currentUser: Colaborador;
  onJobStart: () => void;
}

/**
 * Módulo de Espera do Motorista (v2.0)
 * 
 * No novo fluxo simplificado:
 * - Operador atribui e inicia a rota de uma vez (startRoute)
 * - Motorista NÃO precisa aceitar/recusar
 * - Motorista fica "online" aguardando ser atribuído a uma entrega EM_ROTA
 * - Quando uma entrega EM_ROTA é atribuída a ele, automaticamente vai para a tela de entrega
 */
export const DriverWaitingModule: React.FC<DriverWaitingModuleProps> = ({ currentUser, onJobStart }) => {
  const [isOnline, setIsOnline] = useState(false); // Começa offline para forçar interação
  const [lastPing, setLastPing] = useState(Date.now());
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializa o elemento de áudio
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND);
    audioRef.current.loop = false; // Só toca uma vez no novo fluxo
    audioRef.current.volume = 1.0;
  }, []);

  // Polling de Jobs e Heartbeat
  useEffect(() => {
    if (!isOnline) return;

    const checkJobs = async () => {
      // 1. Enviar batimento cardíaco (estou vivo e disponível)
      await updateDriverHeartbeat(currentUser, undefined, undefined, 'DISPONIVEL');
      setLastPing(Date.now());

      // 2. Verificar se tem job EM_ROTA atribuído para mim (novo fluxo)
      const jobs = await listDeliveryJobs();
      const myJob = jobs.find(j => j.assignedDriverId === currentUser.id && j.status === 'EM_ROTA');

      if (myJob) {
        // Tocar som de notificação
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Áudio bloqueado pelo navegador", e));
        }
        // Vibrar celular se suportado
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        
        // Ir direto para a tela de entrega ativa
        onJobStart();
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
  }, [isOnline, currentUser, onJobStart]);

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

  // --- RENDER: TELA DE ESPERA (RADAR) ---
  // No novo fluxo (v2.0), não há tela de aceitar/recusar.
  // O operador atribui e inicia a rota; o motorista apenas aguarda ser chamado.
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
          {isOnline ? 'O operador enviará entregas para você' : 'Ative para receber entregas'}
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



