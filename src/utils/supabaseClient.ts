import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e/ou chave anônima não configurados. Verifique as variáveis de ambiente.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
});