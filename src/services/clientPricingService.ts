import { supabase } from '@/utils/supabaseClient';
import type { Database } from '@/types/supabase';

export type ClientPriceOverrideRow =
  Database['public']['Tables']['client_price_overrides']['Row'];

export type ClientPriceOverrideInsert =
  Database['public']['Tables']['client_price_overrides']['Insert'];

const CLIENT_PRICE_OVERRIDE_FIELDS =
  'id,client_id,product_id,deposit_id,modality,special_price,is_active,created_at' as const;

const normalizeMode = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'SIMPLE';
  const up = raw.toUpperCase();
  if (up === 'SIMPLES') return 'SIMPLE';
  if (up === 'TROCA') return 'EXCHANGE';
  if (up === 'COMPLETA') return 'FULL';
  return up;
};

const normalizeDepositId = (value?: string | null) => {
  const v = String(value ?? '').trim();
  return v ? v : null;
};

export async function listClientPriceOverrides(
  clientId?: string
): Promise<ClientPriceOverrideRow[]> {
  let query = supabase
    .from('client_price_overrides')
    .select(CLIENT_PRICE_OVERRIDE_FIELDS);

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao listar precos especiais: ${error.message}`);
  return data || [];
}

export async function upsertClientPriceOverride(
  payload: ClientPriceOverrideInsert
): Promise<ClientPriceOverrideRow> {
  const clientId = payload.client_id;
  const productId = payload.product_id;

  const depositId = normalizeDepositId(payload.deposit_id ?? null);
  const modality = normalizeMode(payload.modality ?? null);

  const specialPrice =
    payload.special_price === undefined ? null : payload.special_price;

  const isActive = payload.is_active ?? true;

  // Se vier ID, atualiza direto por PK
  if (payload.id) {
    const { data, error } = await supabase
      .from('client_price_overrides')
      .update({
        ...payload,
        deposit_id: depositId,
        modality,
        special_price: specialPrice,
        is_active: isActive,
      })
      .eq('id', payload.id)
      .select(CLIENT_PRICE_OVERRIDE_FIELDS)
      .single();

    if (error) throw new Error(`Erro ao salvar preco especial: ${error.message}`);
    return data as ClientPriceOverrideRow;
  }

  // Senão, procura registro existente pela chave lógica (sem ON CONFLICT)
  let find = supabase
    .from('client_price_overrides')
    .select('id')
    .eq('client_id', clientId)
    .eq('product_id', productId)
    .eq('modality', modality)
    .limit(1);

  find = depositId ? find.eq('deposit_id', depositId) : find.is('deposit_id', null);

  const { data: existing, error: findError } = await find.maybeSingle();
  if (findError) {
    throw new Error(`Erro ao salvar preco especial: ${findError.message}`);
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('client_price_overrides')
      .update({
        ...payload,
        deposit_id: depositId,
        modality,
        special_price: specialPrice,
        is_active: isActive,
      })
      .eq('id', existing.id)
      .select(CLIENT_PRICE_OVERRIDE_FIELDS)
      .single();

    if (error) throw new Error(`Erro ao salvar preco especial: ${error.message}`);
    return data as ClientPriceOverrideRow;
  }

  // Não existe: insere
  const { data, error } = await supabase
    .from('client_price_overrides')
    .insert({
      ...payload,
      deposit_id: depositId,
      modality,
      special_price: specialPrice,
      is_active: isActive,
    })
    .select(CLIENT_PRICE_OVERRIDE_FIELDS)
    .single();

  if (error) throw new Error(`Erro ao salvar preco especial: ${error.message}`);
  return data as ClientPriceOverrideRow;
}

export async function deleteClientPriceOverride(id: string): Promise<void> {
  const { error } = await supabase.from('client_price_overrides').delete().eq('id', id);
  if (error) throw new Error(`Erro ao remover preco especial: ${error.message}`);
}
