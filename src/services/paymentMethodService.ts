/**
 * 💳 PAYMENT METHOD SERVICE
 * 
 * Serviço para gerenciar formas de pagamento.
 */

import { supabase } from '@/utils/supabaseClient';
import { Database } from '../types/supabase';

export type PaymentMethodRow = Database['public']['Tables']['payment_methods']['Row'];
export type PaymentMethodInsert = Database['public']['Tables']['payment_methods']['Insert'];
export type PaymentMethodUpdate = Database['public']['Tables']['payment_methods']['Update'];

// Tipo compatível com a aplicação
export interface PaymentMethod {
  id: string;
  name: string;
  receipt_type: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other';
  enters_receivables: boolean;
  default_due_days: number;
  is_active: boolean;
  machine_label?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

// Converte do formato DB para formato da aplicação
function fromDbRow(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    receipt_type: row.type,
    enters_receivables: row.generates_receivable,
    default_due_days: 0, // Campo não existe no DB, usar valor padrão
    is_active: row.is_active,
    machine_label: undefined, // Campo não existe no DB
    created_at: row.created_at,
    updated_at: undefined // Campo não existe no DB
  };
}

// Converte do formato da aplicação para formato DB
function toDbInsert(method: PaymentMethod): PaymentMethodInsert {
  return {
    id: method.id,
    name: method.name,
    type: method.receipt_type,
    generates_receivable: method.enters_receivables,
    is_active: method.is_active,
    created_at: method.created_at || new Date().toISOString()
  };
}

export const paymentMethodService = {
  /**
   * 1. Listar todas as formas de pagamento
   */
  async getAll(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('name');

    if (error) throw new Error(`Erro ao listar formas de pagamento: ${error.message}`);
    return (data || []).map(fromDbRow);
  },

  /**
   * 2. Listar apenas formas de pagamento ativas
   */
  async getActive(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Erro ao listar formas de pagamento ativas: ${error.message}`);
    return (data || []).map(fromDbRow);
  },

  /**
   * 3. Buscar uma forma de pagamento por ID
   */
  async getById(id: string): Promise<PaymentMethod | null> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Erro ao buscar forma de pagamento: ${error.message}`);
    }
    
    return data ? fromDbRow(data) : null;
  },

  /**
   * 4. Criar ou atualizar forma de pagamento
   */
  async upsert(method: PaymentMethod): Promise<PaymentMethod> {
    const dbData = toDbInsert(method);
    
    const { data, error } = await supabase
      .from('payment_methods')
      .upsert(dbData)
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar forma de pagamento: ${error.message}`);
    return fromDbRow(data);
  },

  /**
   * 5. Criar nova forma de pagamento
   */
  async create(method: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentMethod> {
    const newMethod: PaymentMethod = {
      ...method,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return this.upsert(newMethod);
  },

  /**
   * 6. Atualizar forma de pagamento existente
   */
  async update(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Forma de pagamento não encontrada');
    }

    const updated: PaymentMethod = {
      ...existing,
      ...updates,
      id, // Garante que o ID não mude
      updated_at: new Date().toISOString()
    };

    return this.upsert(updated);
  },

  /**
   * 7. Desativar forma de pagamento (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new Error(`Erro ao desativar forma de pagamento: ${error.message}`);
  },

  /**
   * 8. Reativar forma de pagamento
   */
  async activate(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: true })
      .eq('id', id);

    if (error) throw new Error(`Erro ao ativar forma de pagamento: ${error.message}`);
  },

  /**
   * 9. Deletar forma de pagamento permanentemente
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Erro ao deletar forma de pagamento: ${error.message}`);
  }
};
