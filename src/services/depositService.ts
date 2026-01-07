/**
 * 🏢 DEPOSIT SERVICE (v3.0 - Online-Only)
 * 
 * Camada de serviço para operações com Depósitos/Lojas.
 * TODAS as chamadas ao Supabase para 'deposits' devem passar por aqui.
 * 
 * ⚠️ IMPORTANTE (v3.0):
 * - Conexão DIRETA ao Supabase (sem cache local)
 * - Erros são lançados com detalhes técnicos (use try/catch nos componentes)
 * - Use o hook useToast() nos componentes para feedback visual
 */

import { supabase } from '@/utils/supabaseClient';
import type { Database } from '@/types/supabase';

// Atalhos de tipos (facilita uso nos componentes)
export type Deposit = Database['public']['Tables']['deposits']['Row'];
export type NewDeposit = Database['public']['Tables']['deposits']['Insert'];
export type UpdateDeposit = Database['public']['Tables']['deposits']['Update'];

/**
 * Service Pattern para Deposits (v3.0)
 */
export const depositService = {
  /**
   * 1. Listar todos os depósitos ativos
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async getAll(): Promise<Deposit[]> {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) throw error; // ⚠️ Lança o erro original do Supabase (com details, code, hint)
    return data || [];
  },

  /**
   * 2. Buscar depósito por ID
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async getById(id: string): Promise<Deposit | null> {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error; // ⚠️ Lança o erro original do Supabase
    }
    return data;
  },

  /**
   * 3. Criar novo depósito
   * 
   * @example
   * // No componente:
   * import { useToast } from '@/hooks/useToast';
   * const { showSuccess, showError } = useToast();
   * 
   * try {
   *   const newDeposit = await depositService.create({
   *     name: 'Matriz Centro',
   *     address: 'Rua Principal, 123',
   *     color: '#3b82f6'
   *   });
   *   showSuccess('Depósito criado com sucesso!');
   * } catch (error) {
   *   showError('Erro ao criar depósito', error);
   * }
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async create(deposit: NewDeposit): Promise<Deposit> {
    const { data, error } = await supabase
      .from('deposits')
      .insert(deposit as Database['public']['Tables']['deposits']['Insert'])
      .select()
      .single();

    if (error) throw error; // ⚠️ Lança o erro original (ex: constraint violations)
    return data;
  },

  /**
   * 4. Atualizar depósito existente
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async update(id: string, updates: UpdateDeposit): Promise<Deposit> {
    const { data, error } = await supabase
      .from('deposits')
      .update(updates as Database['public']['Tables']['deposits']['Update'])
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error; // ⚠️ Lança o erro original
    return data;
  },

  /**
   * 5. Desativar depósito (soft delete)
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('deposits')
      .update({ active: false } as Database['public']['Tables']['deposits']['Update'])
      .eq('id', id);

    if (error) throw error; // ⚠️ Lança o erro original
  },

  /**
   * 6. Deletar permanentemente (usar com cuidado!)
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('deposits')
      .delete()
      .eq('id', id);

    if (error) throw error; // ⚠️ Lança o erro original
  },

  /**
   * 7. Verificar se depósito tem estoque
   * (útil antes de deletar)
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async hasStock(id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('stock_balance')
      .select('id')
      .eq('deposit_id', id)
      .gt('quantity', 0)
      .limit(1);

    if (error) throw error; // ⚠️ Lança o erro original
    return (data?.length || 0) > 0;
  },

  /**
   * 8. Verificar se depósito tem vendas
   * (útil antes de deletar)
   * 
   * @throws Error com detalhes do Supabase se falhar
   */
  async hasSales(id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('service_orders')
      .select('id')
      .eq('deposit_id', id)
      .limit(1);

    if (error) throw error; // ⚠️ Lança o erro original
    return (data?.length || 0) > 0;
  },
};
