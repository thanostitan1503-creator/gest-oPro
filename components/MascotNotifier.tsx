import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSystemAlerts, SystemAlert } from '../src/hooks/useSystemAlerts';
import { Maps } from '../src/utils/navigation';

const MascotNotifier: React.FC = () => {
  const alerts = useSystemAlerts();
  const [alertIndex, setAlertIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalAlerts = alerts.length;
  const currentAlert = totalAlerts > 0 ? alerts[alertIndex % totalAlerts] : null;
  const hasCritical = useMemo(
    () => alerts.some((alert) => alert.type === 'critical'),
    [alerts]
  );

  useEffect(() => {
    if (alertIndex >= totalAlerts) {
      setAlertIndex(0);
    }
  }, [alertIndex, totalAlerts]);

  useEffect(() => {
    if (totalAlerts <= 1) return;
    const interval = setInterval(() => {
      setAlertIndex((prevIndex) => (prevIndex + 1) % totalAlerts);
    }, 5000);
    return () => clearInterval(interval);
  }, [totalAlerts]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleAlertClick = (alert: SystemAlert) => {
    Maps(alert.link);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-[9999] select-none">
      <div className="relative flex items-center justify-center">
        {currentAlert && (
          <div
            className={`absolute -top-24 left-1/2 -translate-x-1/2 bg-white text-gray-900 border rounded-xl shadow-xl px-4 py-3 text-xs w-64 animate-in fade-in duration-300 ${
              hasCritical ? 'border-red-500' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {(hasCritical || currentAlert.type === 'critical') && (
                <span className="text-red-600 font-black">!</span>
              )}
              <span className="font-semibold">{currentAlert.message}</span>
            </div>
            <div
              className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rotate-45 ${
                hasCritical ? 'border-red-500' : 'border-gray-200'
              } border-b border-l`}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg transition-transform active:scale-95 ${
            hasCritical ? 'bg-red-600' : 'bg-slate-900'
          }`}
          aria-label="Abrir alertas do sistema"
        >
          GP
          {totalAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white">
              {totalAlerts}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute bottom-20 right-0 w-72 bg-white text-gray-900 border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="px-4 py-3 border-b border-gray-200 text-[10px] font-black uppercase text-gray-500">
              Alertas do sistema ({totalAlerts})
            </div>
            <div className="max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="px-4 py-4 text-xs text-gray-500">Nenhum alerta ativo.</div>
              ) : (
                alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => handleAlertClick(alert)}
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
      </div>
    </div>
  );
};

export default MascotNotifier;



