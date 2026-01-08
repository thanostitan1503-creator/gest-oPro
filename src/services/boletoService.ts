import { supabase } from '@/utils/supabaseClient';
import { Database } from '../types/supabase';

export type BoletoRow = Database['public']['Tables']['boletos']['Row'];
export type NewBoleto = Database['public']['Tables']['boletos']['Insert'];
export type UpdateBoleto = Database['public']['Tables']['boletos']['Update'];

const BOLETO_FIELDS =
  'id,receivable_id,amount,bank_name,barcode,digitable_line,pdf_url,status,due_date,issue_date,created_at,updated_at';

const normalizeDueDate = (value?: string | number | null) => {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value).toISOString().split('T')[0];
  return value;
};

export const boletoService = {
  async getByReceivableId(receivableId: string): Promise<BoletoRow | null> {
    const { data, error } = await supabase
      .from('boletos')
      .select(BOLETO_FIELDS)
      .eq('receivable_id', receivableId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar boleto: ${error.message}`);
    }
    return data || null;
  },

  async upsert(payload: NewBoleto): Promise<BoletoRow> {
    const now = new Date().toISOString();
    const insert: NewBoleto = {
      ...payload,
      due_date: normalizeDueDate(payload.due_date) ?? null,
      issue_date: payload.issue_date ?? now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('boletos')
      .upsert(insert as NewBoleto)
      .select(BOLETO_FIELDS)
      .maybeSingle();

    if (error) throw new Error(`Erro ao salvar boleto: ${error.message}`);
    if (!data) throw new Error('Boleto nao retornou apos salvar');
    return data;
  },

  async updateStatus(id: string, status: string): Promise<BoletoRow> {
    const { data, error } = await supabase
      .from('boletos')
      .update({ status, updated_at: new Date().toISOString() } as UpdateBoleto)
      .eq('id', id)
      .select(BOLETO_FIELDS)
      .maybeSingle();

    if (error) throw new Error(`Erro ao atualizar boleto: ${error.message}`);
    if (!data) throw new Error('Boleto nao retornou apos atualizar');
    return data;
  },
};
