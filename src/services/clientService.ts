/**
 * 👥 CLIENT SERVICE
 * 
 * Serviço para gestão de Clientes.
 */

import { supabase } from '@/utils/supabaseClient';
import { Database } from '../types/supabase';

export type Client = Database['public']['Tables']['clients']['Row'];
export type NewClient = Database['public']['Tables']['clients']['Insert'];
export type UpdateClient = Database['public']['Tables']['clients']['Update'];

const normalizeTextValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeIdValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const buildFullAddress = (
  street?: string | null,
  neighborhood?: string | null,
  fallback?: string | null
) => {
  const parts = [normalizeTextValue(street), normalizeTextValue(neighborhood)].filter(Boolean);
  if (parts.length > 0) return parts.join(' - ');
  return normalizeTextValue(fallback);
};

const buildClientPayload = <T extends NewClient | UpdateClient>(client: T): T => {
  const street = normalizeTextValue(client.street_address);
  const neighborhood = normalizeTextValue(client.neighborhood);
  const address = buildFullAddress(street, neighborhood, client.address ?? null);

  return {
    ...client,
    street_address: street,
    neighborhood,
    delivery_sector_id: normalizeIdValue(client.delivery_sector_id),
    address,
  };
};

export const clientService = {
  /**
   * 1. Listar clientes (ativos por padrao)
   */
  async getAll(options?: { includeInactive?: boolean }): Promise<Client[]> {
    let query = supabase.from('clients').select('*');
    if (!options?.includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('name');
    
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
      .maybeSingle();
    
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
      .maybeSingle();
    
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
    const payload = buildClientPayload(client);
    const { data, error } = await supabase
      .from('clients')
      .insert(payload as Database['public']['Tables']['clients']['Insert'])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar cliente: ${error.message}`);
    return data;
  },

  /**
   * 5. Atualizar cliente
   */
  async update(id: string, updates: UpdateClient): Promise<Client> {
    const payload = buildClientPayload(updates);
    const { data, error } = await supabase
      .from('clients')
      .update(payload as Database['public']['Tables']['clients']['Update'])
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
      .update({ is_active: false } as Database['public']['Tables']['clients']['Update'])
      .eq('id', id);

    if (error) throw new Error(`Erro ao desativar cliente: ${error.message}`);
  },

  /**
   * 6. Remover cliente permanentemente
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Erro ao remover cliente: ${error.message}`);
  },

  /**
   * 7. Buscar clientes por setor
   */
  async getBySector(sectorId: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('delivery_sector_id', sectorId)
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
        accounts_receivable!inner(remaining_amount, original_amount)
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
      const remaining = Number(row.accounts_receivable?.remaining_amount ?? row.accounts_receivable?.original_amount ?? 0);
      client.debt += Number.isFinite(remaining) ? remaining : 0;
    });
    
    return Array.from(clientsMap.values());
  }
};
