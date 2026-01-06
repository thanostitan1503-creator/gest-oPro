/**
 * 👥 CLIENT SERVICE
 * 
 * Serviço para gestão de Clientes.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export type Client = Database['public']['Tables']['clients']['Row'];
export type NewClient = Database['public']['Tables']['clients']['Insert'];
export type UpdateClient = Database['public']['Tables']['clients']['Update'];

export const clientService = {
  /**
   * 1. Listar todos os clientes ativos
   */
  async getAll(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao listar clientes: ${error.message}`);
    return data || [];
  },

  /**
   * 2. Buscar cliente por ID
   */
  async getById(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }
    return data;
  },

  /**
   * 3. Buscar cliente por telefone
   */
  async getByPhone(phone: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }
    return data;
  },

  /**
   * 4. Criar cliente
   */
  async create(client: NewClient): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar cliente: ${error.message}`);
    return data;
  },

  /**
   * 5. Atualizar cliente
   */
  async update(id: string, updates: UpdateClient): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    return data;
  },

  /**
   * 6. Desativar cliente
   */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new Error(`Erro ao desativar cliente: ${error.message}`);
  },

  /**
   * 7. Buscar clientes por setor
   */
  async getBySector(sectorId: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('sector_id', sectorId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao buscar clientes: ${error.message}`);
    return data || [];
  },

  /**
   * 8. Buscar clientes com débito
   */
  async getWithDebt(): Promise<Array<Client & { debt: number }>> {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        accounts_receivable!inner(amount)
      `)
      .eq('is_active', true)
      .eq('accounts_receivable.status', 'PENDENTE');
    
    if (error) throw new Error(`Erro ao buscar clientes: ${error.message}`);
    
    // Agrupa dívidas por cliente
    const clientsMap = new Map<string, Client & { debt: number }>();
    (data || []).forEach((row: any) => {
      if (!clientsMap.has(row.id)) {
        clientsMap.set(row.id, { ...row, debt: 0 });
      }
      const client = clientsMap.get(row.id)!;
      client.debt += row.accounts_receivable.amount;
    });
    
    return Array.from(clientsMap.values());
  }
};
