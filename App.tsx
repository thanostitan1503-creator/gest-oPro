import React, { useState, useEffect, useMemo } from 'react';
import { Cylinder, LogOut, Loader2 } from 'lucide-react';
import { DASHBOARD_ITEMS } from './constants';
import { DashboardCard } from './components/DashboardCard';
import { NewServiceOrder } from './components/NewServiceOrder';
import { ControlPanel } from './components/ControlPanel';
import { SummaryModule } from './components/SummaryModule';
import { FinancialModule } from './components/FinancialModule';

import { SalesModalitiesModule } from './components/SalesModalitiesModule';
import { TransactionModalitiesModule } from './components/TransactionModalitiesModule';
import { ShiftClosingModal } from './components/ShiftClosingModal';
import { ClientsModule } from './components/ClientsModule';
import { AuditModule } from './components/AuditModule';
import { ThemesModule } from './components/ThemesModule';
import { DeliveryReportModule } from './components/DeliveryReportModule';
import { DeliverySettingsModal } from './components/DeliverySettingsModal';
import { DeliveryDispatchModule } from './components/DeliveryDispatchModule';
import { DepositsStockModule } from './components/DepositsStockModule';

import { AlertsModule } from './components/AlertsModule';
import { EmployeesModule } from './components/EmployeesModule';
import { LoginScreen } from './components/LoginScreen';
import { DriverPanel } from './components/DriverPanel'; 
import { GasRobot } from './components/GasRobot';
import { OpeningShiftModal } from './components/OpeningShiftModal';
import { Colaborador, UserRole } from '@/domain/types';
import { THEMES, ThemeId } from '@/domain/themes';
import {
  initStorage,
  getThemeBackgroundImage,
  getThemeBackgroundOpacity,
  setThemeBackgroundImage,
  setThemeBackgroundOpacity,
} from '@/domain/storage';
import { supabase } from '@/domain/supabaseClient';
import { Toaster } from 'sonner';
import { ShiftProvider, useShift } from '@/contexts/ShiftContext';

const ShiftGate: React.FC<{ currentUser: Colaborador; children: React.ReactNode }> = ({ currentUser, children }) => {
  const { activeShift, loading } = useShift();

  // ⚠️ ADM (GERENTE) não precisa de abertura de caixa/turno
  if (currentUser.cargo === 'ENTREGADOR' || currentUser.cargo === 'GERENTE') return <>{children}</>;

  return (
    <>
      {children}
      {loading && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center text-white text-sm font-bold">
          Carregando turno...
        </div>
      )}
      {!loading && !activeShift && <OpeningShiftModal user={currentUser} />}
    </>
  );
};

const App: React.FC = () => {
  // -- Init State --
  const [isStorageReady, setIsStorageReady] = useState(false);

  // -- Auth State --
  const [currentUser, setCurrentUser] = useState<Colaborador | null>(null);

  // -- Navigation State --
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  
  // -- Theme State --
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem('gp_theme') as ThemeId) || 'light';
  });
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
    return getThemeBackgroundImage();
  });
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(() => {
    return getThemeBackgroundOpacity();
  });

  // Initialize System (Load Data from DB)
  useEffect(() => {
    const startSystem = async () => {
      console.log('Iniciando o sistema...');
      const storageInitialized = await initStorage();
      console.log('Storage inicializado:', storageInitialized);

      if (storageInitialized) {
        setBackgroundImage(getThemeBackgroundImage());
        setBackgroundOpacity(getThemeBackgroundOpacity());
      }
      
      // Restore Session
      const session = localStorage.getItem('gp_session');
      if (session) {
        try {
          const user = JSON.parse(session);
          setCurrentUser(user);
        } catch (e) {
          console.error("Session parse error", e);
          localStorage.removeItem('gp_session');
        }
      }
      
      if (!storageInitialized) {
        console.error('Erro ao inicializar o storage. Forçando estado pronto.');
        setIsStorageReady(true);
      }
      
      setIsStorageReady(true);
    };
    startSystem();
  }, []);

  // Teste técnico (DEV): valida conexão/tabela/RLS no console sem mexer na UI
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (async () => {
      try {
        const { data, error } = await supabase.from('deposits').select('*').limit(1);
        // eslint-disable-next-line no-console
        console.log('SUPABASE_TEST', { data, error });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('SUPABASE_TEST_EXCEPTION', e);
      }
    })();
  }, []);

  // Apply Theme Logic
  useEffect(() => {
    const theme = THEMES.find(t => t.id === currentTheme) || THEMES[0];
    const root = document.documentElement;

    root.style.setProperty('--app-bg', theme.colors.appBg);
    root.style.setProperty('--surface-bg', theme.colors.surfaceBg);
    root.style.setProperty('--text-main', theme.colors.textMain);
    root.style.setProperty('--text-muted', theme.colors.textMuted);
    root.style.setProperty('--border-color', theme.colors.border);
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--app-pattern', theme.pattern ?? 'none');
    root.style.setProperty('--bg-image', backgroundImage ? `url("${backgroundImage}")` : 'none');
    root.style.setProperty('--bg-opacity', String(backgroundOpacity));
    
    localStorage.setItem('gp_theme', currentTheme);
    localStorage.removeItem('gp_bg_image');
    localStorage.removeItem('gp_bg_opacity');
  }, [currentTheme, backgroundImage, backgroundOpacity]);

  // -- Permission Logic --
  const allowedModules = useMemo(() => {
    if (!currentUser) return [];
    
    // Admin sees all
    if (currentUser.cargo === 'GERENTE' || currentUser.username === 'admin') {
      return DASHBOARD_ITEMS;
    }

    // Others see based on 'permissoes' array
    return DASHBOARD_ITEMS.filter(item => 
      currentUser.permissoes?.includes(item.id)
    );
  }, [currentUser]);

  const triggerSearchHighlight = () => {
    const query = searchInput.trim().toLowerCase();
    if (!query) {
      setHighlightedIds([]);
      return;
    }

    const matches = allowedModules
      .filter((item) =>
        item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
      )
      .map((item) => item.id);

    setHighlightedIds(matches);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      triggerSearchHighlight();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gp_session');
    setCurrentUser(null);
    setActiveModule(null);
  };

  const resolveModuleFromLink = (link: string) => {
    switch (link) {
      case '/stock':
        return 'estoque';
      case '/finance':
        return 'financeiro';
      case '/orders':
        return 'nova-os';
      default:
        return null;
    }
  };

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      const target = resolveModuleFromLink(detail);
      if (target) setActiveModule(target);
    };
    window.addEventListener('gp:navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('gp:navigate', handleNavigate as EventListener);
  }, []);

  // Loading Screen
  if (!isStorageReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold tracking-widest uppercase">Inicializando Banco de Dados...</p>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(u) => { setCurrentUser(u); localStorage.setItem('gp_session', JSON.stringify(u)); }} />;
  }

  // --- DRIVER EXCLUSIVE VIEW ---
  if (currentUser.cargo === 'ENTREGADOR') {
    return <DriverPanel currentUser={currentUser} onLogout={handleLogout} />;
  }

  // --- ADMIN / COLLABORATOR DASHBOARD ---
  const renderModule = () => {
    // Módulos Internos (Acessados via Painel de Controle ou botões diretos, não estão no Grid do Dashboard)
    const INTERNAL_MODULES = ['dispatch', 'sales-modalities', 'transaction-modalities', 'delivery-settings'];

    // Security Check: Active module must be allowed
    const isAllowed = 
      INTERNAL_MODULES.includes(activeModule || '') ||
      allowedModules.some(m => m.id === activeModule);

    if (activeModule && !isAllowed) {
      // Bloqueio de segurança: impede renderizar módulo não permitido
      return null; 
    }

    switch (activeModule) {
      case 'dispatch': return <DeliveryDispatchModule onClose={() => setActiveModule(null)} />;
      case 'nova-os': return <NewServiceOrder onClose={() => setActiveModule(null)} currentUser={currentUser} />;
      case 'clientes': return <ClientsModule onClose={() => setActiveModule(null)} userRole={currentUser.cargo === 'GERENTE' ? 'ADMIN' : 'COLABORADOR'} />;
      case 'painel': return <ControlPanel onClose={() => setActiveModule(null)} onNavigate={(m) => setActiveModule(m)} />;

      case 'resumo': return <SummaryModule onClose={() => setActiveModule(null)} />;
      case 'financeiro': return <FinancialModule onClose={() => setActiveModule(null)} onNavigate={(m) => setActiveModule(m)} />;

      case 'sales-modalities': return <SalesModalitiesModule onClose={() => setActiveModule(null)} />;
      case 'transaction-modalities': return <TransactionModalitiesModule onClose={() => setActiveModule(null)} />;
      case 'fechar-caixa': return <ShiftClosingModal onClose={() => setActiveModule(null)} />;
      case 'auditoria': return <AuditModule onClose={() => setActiveModule(null)} />;
      case 'rel-entregas': return <DeliveryReportModule onClose={() => setActiveModule(null)} />;
      case 'delivery-settings': return <DeliverySettingsModal onClose={() => setActiveModule(null)} />;
      case 'alertas': return <AlertsModule onClose={() => setActiveModule(null)} />;
      case 'colaboradores': return <EmployeesModule onClose={() => setActiveModule(null)} />;
      case 'depositos-estoque': return <DepositsStockModule onClose={() => setActiveModule(null)} currentUser={currentUser} />;
      case 'temas':
        return (
          <ThemesModule
            onClose={() => setActiveModule(null)}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            onBackgroundImageChange={async (image) => {
              setBackgroundImage(image ?? null);
              await setThemeBackgroundImage(image ?? null);
            }}
            onBackgroundOpacityChange={(value) => {
              setBackgroundOpacity(value);
              setThemeBackgroundOpacity(value);
            }}
          />
        );
      default: return null;
    }
  };

  return (
    <ShiftProvider currentUser={currentUser}>
      <ShiftGate currentUser={currentUser}>
        <div className="min-h-screen text-txt-main flex flex-col transition-colors duration-300">
      <header className="bg-surface border-b border-bdr p-6 shadow-sm flex justify-between items-center transition-colors duration-300">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2 text-red-600">
            <Cylinder className="w-8 h-8 text-red-600" />
            GÁS REAL
          </h1>
          <p className="text-txt-muted text-xs font-medium mt-1">SISTEMA INTEGRADO DE GESTÃO</p>
        </div>
        <div className="flex items-center gap-6">
          
          {/* Quick Dispatch Button for Admin */}
          {(currentUser.cargo === 'GERENTE' || currentUser.cargo === 'ATENDENTE') && (
             <button 
               onClick={() => setActiveModule('dispatch')}
               className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-transform active:scale-95 shadow-md"
             >
                Despacho de Entregas
             </button>
          )}

          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-txt-main">{currentUser.nome}</p>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{currentUser.cargo} • {currentUser.depositoId}</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary border-2 border-surface flex items-center justify-center font-bold text-white shadow-lg">
                {currentUser.nome.substring(0,2).toUpperCase()}
             </div>
             <button 
               onClick={handleLogout}
               className="p-2 text-txt-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
               title="Sair"
             >
               <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-txt-main tracking-tight mb-2">Painel Operacional</h2>
              <p className="text-txt-muted font-medium">Selecione uma funcionalidade para iniciar o trabalho</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto md:min-w-[360px]">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar função do sistema e pressionar Enter"
                  className="w-full bg-surface border-2 border-bdr rounded-xl px-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <button
                onClick={triggerSearchHighlight}
                className="px-4 py-3 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:bg-primary/90 active:scale-95 transition-all"
              >
                Buscar
              </button>
              {highlightedIds.length > 0 && (
                <button
                  onClick={() => { setHighlightedIds([]); setSearchInput(''); }}
                  className="px-3 py-3 bg-surface border border-bdr text-txt-muted hover:text-red-500 hover:border-red-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {allowedModules.map((item) => (
              <DashboardCard
                key={item.id}
                item={item}
                onClick={setActiveModule}
                highlight={highlightedIds.includes(item.id)}
              />
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-surface border-t border-bdr p-4 text-center text-txt-muted text-xs font-medium transition-colors duration-300">
        &copy; 2025 Gás Real - Sistema de Gestão Inteligente
      </footer>

      {renderModule()}
          <GasRobot />
        </div>
      </ShiftGate>
      <Toaster richColors closeButton position="top-right" />
    </ShiftProvider>
  );
};

export default App;
