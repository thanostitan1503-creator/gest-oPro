import { createClient } from '@supabase/supabase-js';

// Tipo genérico para o banco (ajuda o TypeScript no futuro)
type Database = any; 

// 1. Captura as Chaves (Suporta Vite e Scripts Node ao mesmo tempo)
const supabaseUrl =
  (((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined) ??
   (process.env.VITE_SUPABASE_URL as string | undefined));

const supabaseAnonKey =
  (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined) ??
   (process.env.VITE_SUPABASE_ANON_KEY as string | undefined));

// 2. Trava de Segurança
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('🚨 ERRO: Variáveis de ambiente do Supabase não encontradas.');
}

// 3. Criação do Cliente (Com Realtime e Auth persistente)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Mantém logado ao fechar aba
    autoRefreshToken: true,    // Renova token sozinho
    detectSessionInUrl: true,  // Login por link mágico
  },
  realtime: {
    params: {
      eventsPerSecond: 10,     // Otimização para não sobrecarregar
    },
  },
});

// 4. Modo Debug (Apenas em Desenvolvimento)
// Isso permite que você digite 'window.supabase' no console do Chrome para testar
if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
  (window as any).supabase = supabase;
  console.log('🔧 Supabase exposto globalmente para debug: window.supabase');
}