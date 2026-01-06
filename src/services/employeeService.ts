/**
 * 👥 EMPLOYEE SERVICE (v3.0 - Online-Only)
 * 
 * Gerenciamento de colaboradores com validações de negócio.
 * 
 * ⚠️ REGRAS IMPORTANTES:
 * - GERENTE e ENTREGADOR: deposit_id = null (acesso global)
 * - ATENDENTE e CAIXA: deposit_id obrigatório (acesso local)
 * - Username único (validação no front + constraint no banco)
 */

import { supabase } from '@/utils/supabaseClient';
import type { Database } from '@/types/supabase';

type Employee = Database['public']['Tables']['employees']['Row'];
type NewEmployee = Database['public']['Tables']['employees']['Insert'];
type UpdateEmployee = Database['public']['Tables']['employees']['Update'];

export const employeeService = {
  /**
   * 1. Listar todos os colaboradores ativos
   */
  async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * 2. Buscar colaborador por ID
   */
  async getById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Não encontrado
      throw error;
    }
    return data;
  },

  /**
   * 3. Buscar colaborador por username (para login)
   */
  async getByUsername(username: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Não encontrado
      throw error;
    }
    return data;
  },

  /**
   * 4. Buscar colaboradores por depósito
   */
  async getByDeposit(depositId: string): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('deposit_id', depositId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * 5. Buscar colaboradores por cargo (role)
   */
  async getByRole(role: string): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('role', role)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * 6. Criar colaborador
   * 
   * ⚠️ VALIDAÇÕES:
   * - Username único (constraint no banco)
   * - ATENDENTE/CAIXA: deposit_id obrigatório
   * - GERENTE/ENTREGADOR: deposit_id = null (acesso global)
   * 
   * @example
   * // Criar gerente (acesso global)
   * const gerente = await employeeService.create({
   *   name: 'João Silva',
   *   role: 'GERENTE',
   *   deposit_id: null, // null = acesso global
   *   username: 'joao',
   *   password: 'senha123'
   * });
   * 
   * @example
   * // Criar atendente (acesso local)
   * const atendente = await employeeService.create({
   *   name: 'Maria Santos',
   *   role: 'ATENDENTE',
   *   deposit_id: 'uuid-do-deposito', // obrigatório!
   *   username: 'maria',
   *   password: 'senha456'
   * });
   */
  async create(employee: NewEmployee): Promise<Employee> {
    // Validação de regras de negócio
    const isGlobalRole = employee.role === 'GERENTE' || employee.role === 'ENTREGADOR';
    
    if (!isGlobalRole && !employee.deposit_id) {
      throw new Error(
        `Cargo ${employee.role} requer depósito vinculado. ` +
        'Apenas GERENTE e ENTREGADOR têm acesso global.'
      );
    }

    // Normalizar username (lowercase)
    const normalizedEmployee = {
      ...employee,
      username: employee.username?.toLowerCase(),
      // ⚠️ NÃO enviar 'id' - Supabase gera automaticamente!
    };

    const { data, error } = await supabase
      .from('employees')
      .insert(normalizedEmployee)
      .select()
      .single();

    if (error) {
      // Username duplicado (constraint unique)
      if (error.code === '23505' && error.message.includes('username')) {
        throw new Error(`Username "${employee.username}" já existe. Escolha outro.`);
      }
      throw error; // Erro original (com detalhes)
    }
    return data;
  },

  /**
   * 7. Atualizar colaborador
   */
  async update(id: string, updates: UpdateEmployee): Promise<Employee> {
    // Se está atualizando username, normalizar
    const normalizedUpdates = updates.username 
      ? { ...updates, username: updates.username.toLowerCase() }
      : updates;

    const { data, error } = await supabase
      .from('employees')
      .update(normalizedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Username duplicado
      if (error.code === '23505' && error.message.includes('username')) {
        throw new Error(`Username "${updates.username}" já existe. Escolha outro.`);
      }
      throw error;
    }
    return data;
  },

  /**
   * 8. Desativar colaborador (soft delete)
   * 
   * ⚠️ Colaboradores com histórico NÃO devem ser deletados,
   * apenas desativados (is_active = false).
   */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * 9. Verificar se colaborador tem histórico (vendas, movimentos, etc)
   */
  async hasHistory(id: string): Promise<boolean> {
    const [
      { count: ordersCount },
      { count: movementsCount },
      { count: cashFlowCount }
    ] = await Promise.all([
      // Ordens de serviço (como entregador ou criador)
      supabase.from('service_orders')
        .select('*', { count: 'exact', head: true })
        .or(`driver_id.eq.${id},user_id.eq.${id}`),
      
      // Movimentações de estoque
      supabase.from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id),
      
      // Lançamentos de caixa
      supabase.from('cash_flow_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id)
    ]);

    return (ordersCount || 0) > 0 || (movementsCount || 0) > 0 || (cashFlowCount || 0) > 0;
  },

  /**
   * 10. Validar credenciais (login)
   * 
   * ⚠️ ATENÇÃO: Esta é uma implementação SIMPLIFICADA.
   * Em produção, use hash de senhas (bcrypt) e Supabase Auth.
   */
  async validateCredentials(username: string, password: string): Promise<Employee | null> {
    const employee = await this.getByUsername(username);
    
    if (!employee || employee.password !== password) {
      return null; // Credenciais inválidas
    }

    return employee;
  }
};
