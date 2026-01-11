import { supabase } from '@/utils/supabaseClient';
import type { Database } from '@/types/supabase';

export type ClientDiscountRow =
  Database['public']['Tables']['client_one_time_benefits']['Row'];
export type ClientDiscountInsert =
  Database['public']['Tables']['client_one_time_benefits']['Insert'];
export type ClientDiscountUpdate =
  Database['public']['Tables']['client_one_time_benefits']['Update'];

const CLIENT_DISCOUNT_FIELDS =
  'id,client_id,deposit_id,benefit_type,discount_value,discount_percent,status,used_in_order_id,used_at,expires_at,created_at' as const;

export async function listClientDiscounts(clientId?: string): Promise<ClientDiscountRow[]> {
  let query = supabase.from('client_one_time_benefits').select(CLIENT_DISCOUNT_FIELDS);
  if (clientId) {
    query = query.eq('client_id', clientId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao listar descontos pendentes: ${error.message}`);
  }
  return data || [];
}

export async function saveClientDiscount(
  payload: ClientDiscountInsert
): Promise<ClientDiscountRow> {
  const { data, error } = await supabase
    .from('client_one_time_benefits')
    .upsert(payload)
    .select(CLIENT_DISCOUNT_FIELDS)
    .single();
  if (error) {
    throw new Error(`Erro ao salvar desconto pendente: ${error.message}`);
  }
  return data as ClientDiscountRow;
}

export async function deleteClientDiscount(id: string): Promise<void> {
  const { error } = await supabase.from('client_one_time_benefits').delete().eq('id', id);
  if (error) {
    throw new Error(`Erro ao remover desconto pendente: ${error.message}`);
  }
}
