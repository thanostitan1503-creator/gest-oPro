import { supabase } from '@/utils/supabaseClient';
import type { PaymentMethod, PaymentMethodDepositConfig } from '@/types';
import type { Database } from '@/types/supabase';

type PaymentMethodRow = Database['public']['Tables']['payment_methods']['Row'];
type PaymentMethodInsert = Database['public']['Tables']['payment_methods']['Insert'];
type PaymentMethodUpdate = Database['public']['Tables']['payment_methods']['Update'];
type DepositConfigRow = Database['public']['Tables']['payment_method_deposit_config']['Row'];
type DepositConfigInsert = Database['public']['Tables']['payment_method_deposit_config']['Insert'];

const PAYMENT_METHOD_FIELDS =
  'id,name,method_kind,receipt_type,generates_receivable,is_active,created_at,updated_at';
const DEPOSIT_CONFIG_FIELDS =
  'payment_method_id,deposit_id,is_active,due_days,created_at,updated_at';

const normalizeMethodKind = (value?: string | null): PaymentMethod['method_kind'] => {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'CASH' || upper === 'DINHEIRO') return 'CASH';
  if (upper === 'PIX') return 'PIX';
  if (upper === 'CARD' || upper === 'CARTAO' || upper === 'CREDITO' || upper === 'DEBITO') return 'CARD';
  if (upper === 'FIADO') return 'FIADO';
  if (upper === 'BOLETO') return 'BOLETO';
  if (upper === 'VALE') return 'VALE';
  return 'OTHER';
};

const normalizeReceiptType = (
  value?: string | null,
  methodKind?: string | null
): PaymentMethod['receipt_type'] => {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'IMMEDIATE' || upper === 'DEFERRED') {
    return upper as PaymentMethod['receipt_type'];
  }
  if (upper === 'CASH' || upper === 'PIX') return 'IMMEDIATE';
  if (upper === 'FIADO' || upper === 'BOLETO' || upper === 'VALE') return 'DEFERRED';
  const kind = normalizeMethodKind(methodKind);
  if (kind === 'CASH' || kind === 'PIX') return 'IMMEDIATE';
  if (kind === 'FIADO' || kind === 'BOLETO' || kind === 'VALE') return 'DEFERRED';
  return 'IMMEDIATE';
};

const normalizePaymentMethod = (row: PaymentMethodRow): PaymentMethod => ({
  id: row.id,
  name: row.name ?? '',
  method_kind: normalizeMethodKind(row.method_kind),
  receipt_type: normalizeReceiptType(row.receipt_type, row.method_kind),
  generates_receivable: row.generates_receivable ?? false,
  is_active: row.is_active ?? true,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const normalizeDepositConfig = (row: DepositConfigRow): PaymentMethodDepositConfig => ({
  payment_method_id: row.payment_method_id,
  deposit_id: row.deposit_id,
  is_active: row.is_active,
  due_days: row.due_days,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

export const listPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const { data, error } = await supabase
    .from('payment_methods')
    .select(PAYMENT_METHOD_FIELDS)
    .order('name');

  if (error) throw error;
  return (data || []).map(normalizePaymentMethod);
};

export const createPaymentMethod = async (payload: PaymentMethodInsert): Promise<PaymentMethod> => {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert(payload as PaymentMethodInsert)
    .select(PAYMENT_METHOD_FIELDS)
    .single();

  if (error) throw error;
  return normalizePaymentMethod(data);
};

export const updatePaymentMethod = async (
  id: string,
  payload: PaymentMethodUpdate
): Promise<PaymentMethod> => {
  const { data, error } = await supabase
    .from('payment_methods')
    .update(payload)
    .eq('id', id)
    .select(PAYMENT_METHOD_FIELDS)
    .single();

  if (error) throw error;
  return normalizePaymentMethod(data);
};

export const listPaymentMethodDepositConfigs = async (filters?: {
  paymentMethodId?: string;
  depositId?: string;
}): Promise<PaymentMethodDepositConfig[]> => {
  let query = supabase.from('payment_method_deposit_config').select(DEPOSIT_CONFIG_FIELDS);
  if (filters?.paymentMethodId) {
    query = query.eq('payment_method_id', filters.paymentMethodId);
  }
  if (filters?.depositId) {
    query = query.eq('deposit_id', filters.depositId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeDepositConfig);
};

export const upsertDepositConfig = async (
  deposit_id: string,
  payment_method_id: string,
  config: { is_active: boolean; due_days: number }
): Promise<PaymentMethodDepositConfig> => {
  const payload: DepositConfigInsert = {
    deposit_id,
    payment_method_id,
    is_active: config.is_active,
    due_days: config.due_days,
  };

  const { data, error } = await supabase
    .from('payment_method_deposit_config')
    .upsert(payload, { onConflict: 'payment_method_id,deposit_id' })
    .select(DEPOSIT_CONFIG_FIELDS)
    .single();

  if (error) throw error;
  return normalizeDepositConfig(data);
};

export const getDepositConfig = async (
  deposit_id: string,
  payment_method_id: string
): Promise<PaymentMethodDepositConfig | null> => {
  const { data, error } = await supabase
    .from('payment_method_deposit_config')
    .select(DEPOSIT_CONFIG_FIELDS)
    .eq('deposit_id', deposit_id)
    .eq('payment_method_id', payment_method_id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeDepositConfig(data) : null;
};

export const deletePaymentMethod = async (id: string): Promise<void> => {
  const deleteResponse = await supabase.from('payment_methods').delete().eq('id', id);
  if (!deleteResponse.error) return;

  const updateResponse = await supabase
    .from('payment_methods')
    .update({ is_active: false })
    .eq('id', id);
  if (updateResponse.error) throw updateResponse.error;
};
