/**
 * 📦 SERVICES BARREL EXPORT
 * 
 * Ponto central de importação dos serviços.
 * Use: import { depositService, productService } from '@/services';
 */

// ==================== CORE SERVICES ====================
export * from './depositService';
export * from './productService';
export * from './stockService';
export * from './serviceOrderService';
export * from './clientService';
export * from './financialService';
export * from './deliveryService';
export * from './employeeService'; // 👥 Serviço de colaboradores
export * from './paymentMethodService'; // 💳 Serviço de formas de pagamento

// ==================== HELPER: Cliente Supabase Compartilhado ====================
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no .env');
}

/**
 * Cliente Supabase compartilhado (tipado)
 * Use este em vez de criar novo cliente em cada arquivo
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// ==================== TIPOS ÚTEIS ====================
export type { Database } from '../types/supabase';
export type { Json } from '../types/supabase';
