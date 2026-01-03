import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Move } from 'lucide-react';

import { useSystemAlerts } from '../src/hooks/useSystemAlerts';

import { Maps } from '../src/utils/navigation';



export const GasRobot: React.FC = () => {

  const [position, setPosition] = useState({ x: window.innerWidth - 150, y: window.innerHeight - 150 });

  const [isDragging, setIsDragging] = useState(false);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  const [alertIndex, setAlertIndex] = useState(0);

  const [isOpen, setIsOpen] = useState(false);

  const [mouseDownAt, setMouseDownAt] = useState<{ x: number; y: number } | null>(null);

  const [hasMoved, setHasMoved] = useState(false);



  const alerts = useSystemAlerts();

  const alertCount = alerts.length;

  const currentAlert = alertCount > 0 ? alerts[alertIndex % alertCount] : null;

  const hasCritical = useMemo(

    () => alerts.some((alert) => alert.type === 'critical'),

    [alerts]

  );

  const mood: 'happy' | 'worried' | 'critical' = hasCritical

    ? 'critical'

    : alertCount > 0

      ? 'worried'

      : 'happy';



  const robotRef = useRef<HTMLDivElement>(null);



  useEffect(() => {

    if (alertCount <= 1) return;

    const interval = setInterval(() => {

      setAlertIndex((prevIndex) => (prevIndex + 1) % alertCount);

    }, 5000);

    return () => clearInterval(interval);

  }, [alertCount]);



  useEffect(() => {

    if (alertIndex >= alertCount) {

      setAlertIndex(0);

    }

  }, [alertIndex, alertCount]);



  // Eye Tracking Logic

  useEffect(() => {

    const handleMouseMove = (e: MouseEvent) => {

      // Dragging Logic

      if (isDragging) {

        setPosition({

          x: e.clientX - dragOffset.x,

          y: e.clientY - dragOffset.y

        });

        if (mouseDownAt) {

          const dx = Math.abs(e.clientX - mouseDownAt.x);

          const dy = Math.abs(e.clientY - mouseDownAt.y);

          if (dx > 4 || dy > 4) {

            setHasMoved(true);

          }

        }

      }



      // Eye Tracking Math

      if (robotRef.current) {

        const rect = robotRef.current.getBoundingClientRect();

        const robotCenterX = rect.left + rect.width / 2;

        const robotCenterY = rect.top + rect.height / 2;



        const angle = Math.atan2(e.clientY - robotCenterY, e.clientX - robotCenterX);

        const distance = Math.min(3, Math.hypot(e.clientX - robotCenterX, e.clientY - robotCenterY) / 20);



        setEyeOffset({

          x: Math.cos(angle) * distance,

          y: Math.sin(angle) * distance

        });

      }

    };



    const handleMouseUp = () => {
      setIsDragging(false);
      if (!mouseDownAt) return;
      if (!hasMoved) {
        setIsOpen((prev) => !prev);
      }
      setHasMoved(false);
      setMouseDownAt(null);
    };


    window.addEventListener('mousemove', handleMouseMove);

    window.addEventListener('mouseup', handleMouseUp);



    return () => {

      window.removeEventListener('mousemove', handleMouseMove);

      window.removeEventListener('mouseup', handleMouseUp);

    };

  }, [isDragging, dragOffset, mouseDownAt, hasMoved]);



  const handleMouseDown = (e: React.MouseEvent) => {

    setIsDragging(true);

    setDragOffset({

      x: e.clientX - position.x,

      y: e.clientY - position.y

    });

    setMouseDownAt({ x: e.clientX, y: e.clientY });

    setHasMoved(false);

  };



  const getEyeColor = () => {

    if (mood === 'critical') return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.9)]';

    if (mood === 'worried') return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]';

    return 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]';

  };



  const getScreenColor = () => {

    if (mood === 'critical') return 'bg-red-950/80 border-red-800';

    if (mood === 'worried') return 'bg-amber-950/80 border-amber-800';

    return 'bg-slate-800 border-slate-600';

  };



  const handleAlertClick = (link: string) => {

    Maps(link);

    setIsOpen(false);

  };



  return (

    <div

      ref={robotRef}

      className={`fixed z-[9999] touch-none select-none cursor-move group transition-shadow duration-300 ${isDragging ? 'scale-105' : ''}`}

      style={{

        left: position.x,

        top: position.y,

        filter: isDragging ? 'drop-shadow(0 20px 20px rgba(0,0,0,0.3))' : 'drop-shadow(0 10px 10px rgba(0,0,0,0.2))'

      }}

      onMouseDown={handleMouseDown}

    >

      {currentAlert && (

        <div className="absolute -top-24 left-1/2 -translate-x-1/2">

          <div

            className={`relative bg-white text-gray-900 border rounded-2xl shadow-xl px-4 py-3 text-xs w-64 animate-in fade-in duration-300 ${

              hasCritical ? 'border-red-500' : 'border-gray-200'

            }`}

          >

            <div className={`text-[10px] font-black uppercase ${currentAlert.type === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>

              {currentAlert.type === 'critical' ? 'Critico' : 'Aviso'}

            </div>

            <div className="text-xs font-semibold text-gray-900">{currentAlert.message}</div>

            <div

              className={`absolute -bottom-3 left-8 w-3 h-3 rounded-full bg-white border ${
                hasCritical ? 'border-red-500' : 'border-gray-200'

              }`}

            />

            <div

              className={`absolute -bottom-8 left-14 w-2 h-2 rounded-full bg-white border ${
                hasCritical ? 'border-red-500' : 'border-gray-200'

              }`}

            />

            <div

              className={`absolute -bottom-16 left-20 w-1.5 h-1.5 rounded-full bg-white border ${
                hasCritical ? 'border-red-500' : 'border-gray-200'

              }`}

            />

          </div>

        </div>

      )}



      {alertCount > 0 && (

        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white z-20 animate-bounce">

          {alertCount}

        </div>

      )}



      <div className={`relative ${!isDragging ? 'animate-float' : ''}`}>

        <div className="relative w-20 h-24">

          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-3 bg-slate-300 rounded-full border border-slate-400 z-10"></div>

          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-slate-300 z-0 rounded-sm"></div>



          <div className="absolute top-5 w-full h-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 rounded-3xl border border-slate-400 shadow-inner flex flex-col items-center justify-center overflow-hidden">

            <div className="absolute top-3 left-3 w-4 h-10 bg-white/40 rounded-full blur-[2px]"></div>



            <div className={`w-14 h-9 rounded-xl mt-3 flex items-center justify-center gap-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border relative overflow-hidden transition-colors duration-500 ${getScreenColor()}`}>

              <div className="flex gap-2 transition-transform duration-100" style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}>

                <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${getEyeColor()} ${mood === 'worried' ? 'rounded-t-sm' : ''} ${mood === 'critical' ? 'animate-pulse' : ''}`}></div>

                <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${getEyeColor()} ${mood === 'worried' ? 'rounded-t-sm' : ''} ${mood === 'critical' ? 'animate-pulse' : ''}`}></div>

              </div>



              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent animate-scan"></div>

            </div>



            <div className="mt-3 flex flex-col gap-1 items-center">

              <div className={`w-8 h-0.5 rounded-full transition-colors ${mood === 'critical' ? 'bg-red-400' : 'bg-slate-500'}`}></div>

              <div className={`w-6 h-0.5 rounded-full transition-colors ${mood === 'critical' ? 'bg-red-400' : 'bg-slate-500'}`}></div>

            </div>



            <div className="absolute bottom-4 w-full border-t border-slate-400/30"></div>

          </div>



          <div className={`absolute top-12 -left-3 w-4 h-4 bg-slate-400 rounded-full shadow-sm border border-slate-500 transition-transform ${isDragging ? '-rotate-12' : 'animate-wiggle-left'}`}></div>

          <div className={`absolute top-12 -right-3 w-4 h-4 bg-slate-400 rounded-full shadow-sm border border-slate-500 transition-transform ${isDragging ? 'rotate-12' : 'animate-wiggle-right'}`}></div>



          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded-full whitespace-nowrap pointer-events-none flex items-center gap-1">

            <Move className="w-3 h-3" /> Arraste-me

          </div>

        </div>

      </div>



      {isOpen && (
        <div
          className="absolute left-full top-0 ml-4 w-72 bg-white text-gray-900 border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-200"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-200 text-[10px] font-black uppercase text-gray-500">

            Alertas do sistema ({alertCount})

          </div>

          <div className="max-h-64 overflow-y-auto">

            {alerts.length === 0 ? (

              <div className="px-4 py-4 text-xs text-gray-500">Nenhum alerta ativo.</div>

            ) : (

              alerts.map((alert) => (

                <button

                  key={alert.id}

                  type="button"

                  onClick={() => handleAlertClick(alert.link)}

                  className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"

                >

                  <div

                    className={`text-[10px] font-black uppercase ${

                      alert.type === 'critical' ? 'text-red-600' : 'text-amber-600'

                    }`}

                  >

                    {alert.type === 'critical' ? 'Critico' : 'Aviso'}

                  </div>

                  <div className="text-xs text-gray-800">{alert.message}</div>

                </button>

              ))

            )}

          </div>

        </div>

      )}



      <style>{`

        @keyframes float {

          0%, 100% { transform: translateY(0); }

          50% { transform: translateY(-8px); }

        }

        .animate-float {

          animation: float 3s infinite ease-in-out;

        }

        @keyframes scan {

          0% { transform: translateY(-100%); }

          100% { transform: translateY(100%); }

        }

        .animate-scan {

          animation: scan 2s linear infinite;

        }

      `}</style>

    </div>

  );

};

