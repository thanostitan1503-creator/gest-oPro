
import React, { useState, useEffect } from 'react';
import { Cylinder, Lock, User, ArrowRight, Loader2, Save, Factory, Wifi, WifiOff } from 'lucide-react';
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
import { Colaborador, Deposito } from '@/domain/types';
import { DASHBOARD_ITEMS } from '../constants';
import { supabase } from '@/domain/supabaseClient';
// ⚠️ REMOVIDO v3.0: db local (use Services: import { xxxService } from '@/services')

interface LoginScreenProps {
  onLoginSuccess: (user: Colaborador) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // State for First Run Check
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Setup State
  const [setupName, setSetupName] = useState('Administrador Principal');
  const [setupUser, setSetupUser] = useState('admin');
  const [setupPass, setSetupPass] = useState('');
  const [setupDeposit, setSetupDeposit] = useState('');

  useEffect(() => {
    let mounted = true;
    
    // Monitor connection status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // ✅ v3.0: Buscar direto do Supabase
    supabase.from('employees').select('*').then(({ data }) => {
      if (mounted) setIsFirstRun(!data || data.length === 0);
    });
    
    return () => { 
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Busca usuário do Supabase e sincroniza para local
   * Retorna null se não encontrar ou se não tiver internet
   */
  const fetchUserFromCloud = async (username: string): Promise<Colaborador | null> => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .or(`username.eq.${username},nome.eq.${username}`)
        .single();
      
      if (error || !data) return null;
      
      // ✅ Normalizar depositoId usando a mesma lógica do repository
      const normalizedDepositId = data.depositoId ?? data.deposito_id ?? data.deposit_id ?? null;
      
      // Normalizar dados do Supabase
      const cloudUser: Colaborador = {
        id: data.id,
        nome: data.nome || data.name,
        cpf: data.cpf,
        telefone: data.telefone || data.phone,
        cargo: data.cargo || data.role,
        depositoId: normalizedDepositId, // ✅ Usar valor normalizado
        ativo: data.ativo !== false,
        username: data.username,
        password: data.password,
        permissoes: data.permissoes || data.permissions || [],
      };
      
      // Sincronizar para local (sem enfileirar no outbox para evitar loop)
      await db.employees.put(cloudUser);
      
      return cloudUser;
    } catch (err) {
      console.error('Erro ao buscar usuário da nuvem:', err);
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const inputUser = username.trim().toLowerCase();
      const inputPass = password.trim();

      let user: Colaborador | undefined;
      
      // ✅ v3.0: Buscar direto do Supabase (não há mais cache local)
      if (!isOnline) {
        setError('Sem conexão com a internet. Conecte-se e tente novamente.');
        setIsLoading(false);
        return;
      }

      const cloudUser = await fetchUserFromCloud(inputUser);
      if (cloudUser) {
        user = cloudUser;
      } else {
        // Não existe na nuvem
        setError('Usuário não encontrado!');
        setIsLoading(false);
        return;
      }

      // ✅ v3.0: Verificar se está ativo
      if (!user.ativo) {
        setError('Usuário inativo!');
        setIsLoading(false);
        return;
      }

      // ✅ REGRA: Apenas cargos globais (GERENTE/ENTREGADOR) podem não ter depositoId
      const isGlobalRole = user.cargo === 'GERENTE' || user.cargo === 'ENTREGADOR';
      if (!isGlobalRole && !user.depositoId) {
        setError(`Usuário sem depósito vinculado! Cargo ${user.cargo} deve ter depósito definido. Contate o administrador.`);
        setIsLoading(false);
        return;
      }

      // 6. Conferir se a senha digitada bate com a do banco
      const storedPass = (user.password || '').trim();
      if (!storedPass || storedPass !== inputPass) {
        setError('Senha incorreta!');
        setIsLoading(false);
        return;
      }

      // 7. Se passou, libera login
      onLoginSuccess(user);
      setIsLoading(false);
    } catch (err) {
      console.error('Erro ao autenticar:', err);
      setError('Erro ao conectar ao banco de dados.');
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName || !setupUser || !setupPass || !setupDeposit) {
      setError('Todos os campos são obrigatórios.');
      return;
    }
    
    setIsLoading(true);

    try {
      // 1. Create Default Deposit with proper UUID - usando repository pattern
      const newDeposit: Deposito = {
        id: crypto.randomUUID(), // ✅ CORRIGIDO: UUID válido
        nome: setupDeposit,
        endereco: 'Endereço Principal',
        ativo: true,
        corIdentificacao: 'blue'
      };
      
      // ✅ v3.0: Salvar direto no Supabase
      const { error: depositError } = await supabase.from('deposits').insert(newDeposit);
      if (depositError) throw depositError;

      // 2. Create Admin User usando Supabase direto
      const newAdmin: Colaborador = {
        id: crypto.randomUUID(), // ✅ UUID válido
        nome: setupName,
        cargo: 'GERENTE',
        depositoId: newDeposit.id, // ✅ Vinculado ao depósito criado
        ativo: true,
        username: setupUser.trim(),
        password: setupPass.trim(),
        permissoes: DASHBOARD_ITEMS.map(i => i.id) // Full access
      };
      
      // ✅ v3.0: Salvar direto no Supabase
      const { error: employeeError } = await supabase.from('employees').insert(newAdmin);
      if (employeeError) throw employeeError;

      // 3. Auto Login
      setTimeout(() => onLoginSuccess(newAdmin), 500);
    } catch (err) {
      console.error('Erro ao criar depósito:', err);
      setError('Erro ao configurar sistema. Tente novamente.');
      setIsLoading(false);
    }
  };

  if (isFirstRun === null) return null; // Loading check

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Connection Status Indicator */}
      <div className="absolute top-4 right-4 z-20">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold ${
          isOnline 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
      
      {/* Animated Background Elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-600/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]"></div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl shadow-lg mb-6 transform rotate-3 hover:rotate-6 transition-transform">
            <Cylinder className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Gás <span className="text-red-500">Real</span></h1>
          <p className="text-slate-400 text-sm font-medium mt-2">Sistema Integrado de Gestão</p>
        </div>

        {isFirstRun ? (
          /* --- SETUP FORM --- */
          <form onSubmit={handleSetup} className="space-y-5">
            <div className="bg-blue-500/20 border border-blue-500/30 p-4 rounded-xl text-blue-200 text-xs font-medium text-center">
              Bem-vindo! Vamos configurar seu acesso administrativo e o primeiro depósito.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Nome do Administrador</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                placeholder="Ex: Seu Nome"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Nome do Depósito Principal</label>
              <div className="relative">
                 <Factory className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                 <input
                  type="text"
                  value={setupDeposit}
                  onChange={(e) => setSetupDeposit(e.target.value)}
                  className="w-full pl-10 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                  placeholder="Ex: Nome do Depósito"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Usuário</label>
                <input
                  type="text"
                  value={setupUser}
                  onChange={(e) => setSetupUser(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Senha</label>
                <input
                  type="password"
                  value={setupPass}
                  onChange={(e) => setSetupPass(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500 transition-all"
                  placeholder="****"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> INICIAR SISTEMA</>}
            </button>
          </form>
        ) : (
          /* --- LOGIN FORM --- */
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Usuário</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500 group-focus-within:text-red-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="Seu usuário de acesso"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-red-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all font-medium tracking-wide"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold text-center animate-in shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black rounded-xl shadow-lg shadow-red-900/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  ACESSAR SISTEMA
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
      
      <div className="absolute bottom-4 text-slate-600 text-[10px] font-mono">
        v2.5.0 • Build 2025
      </div>
    </div>
  );
};



