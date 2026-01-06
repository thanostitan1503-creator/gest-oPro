import { supabase } from '@/domain/supabaseClient';
import { generateId } from '@/domain/db';
import type { Boleto } from '../types/boleto';

const normalizeDueDate = (val?: string | null) => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

const normalizeStatus = (status?: string | null): Boleto['status'] => {
  if (!status) return 'PENDENTE';
  const upper = String(status).toUpperCase();
  if (upper === 'REGISTRADO') return 'GERADO';
  if (upper === 'GERADO' || upper === 'ENVIADO' || upper === 'PAGO' || upper === 'CANCELADO') {
    return upper as Boleto['status'];
  }
  return 'PENDENTE';
};

const toEntity = (row: any): Boleto => ({
  id: row.id,
  receivable_id: row.receivable_id,
  bank_name: row.bank_name ?? null,
  wallet: row.wallet ?? null,
  our_number: row.our_number ?? row.nosso_numero ?? null,
  barcode: row.barcode ?? null,
  digitable_line: row.digitable_line ?? null,
  pdf_url: row.pdf_url ?? null,
  status: normalizeStatus(row.status),
  due_date: row.due_date ?? null,
  created_at: row.created_at ?? null,
});

export async function getByReceivableId(receivableId: string): Promise<Boleto | null> {
  const { data, error } = await supabase
    .from('boletos')
    .select('*')
    .eq('receivable_id', receivableId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return toEntity(data[0]);
}

export async function create(
  boleto: Omit<Boleto, 'id' | 'created_at'> & { id?: string }
): Promise<Boleto> {
  const payload = {
    id: boleto.id || generateId(),
    receivable_id: boleto.receivable_id,
    bank_name: boleto.bank_name ?? null,
    wallet: boleto.wallet ?? null,
    our_number: boleto.our_number ?? null,
    barcode: boleto.barcode ?? null,
    digitable_line: boleto.digitable_line ?? null,
    pdf_url: boleto.pdf_url ?? null,
    status: boleto.status ?? 'PENDENTE',
    due_date: normalizeDueDate(boleto.due_date),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('boletos').insert(payload).select('*').single();
  if (error) throw error;
  return toEntity(data);
}

export async function update(boleto: Partial<Boleto> & { id: string }): Promise<Boleto> {
  const payload = {
    bank_name: boleto.bank_name ?? null,
    wallet: boleto.wallet ?? null,
    our_number: boleto.our_number ?? null,
    barcode: boleto.barcode ?? null,
    digitable_line: boleto.digitable_line ?? null,
    pdf_url: boleto.pdf_url ?? null,
    status: boleto.status ?? 'PENDENTE',
    due_date: normalizeDueDate(boleto.due_date),
  };

  const { data, error } = await supabase
    .from('boletos')
    .update(payload)
    .eq('id', boleto.id)
    .select('*')
    .single();

  if (error) throw error;
  return toEntity(data);
}

export async function upsert(boleto: Partial<Boleto>): Promise<Boleto> {
  if (!boleto.receivable_id) throw new Error('Receivable id obrigatorio.');
  const payload = {
    id: boleto.id || generateId(),
    receivable_id: boleto.receivable_id,
    bank_name: boleto.bank_name ?? null,
    wallet: boleto.wallet ?? null,
    our_number: boleto.our_number ?? null,
    barcode: boleto.barcode ?? null,
    digitable_line: boleto.digitable_line ?? null,
    pdf_url: boleto.pdf_url ?? null,
    status: boleto.status ?? 'PENDENTE',
    due_date: normalizeDueDate(boleto.due_date),
    created_at: boleto.created_at ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('boletos')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return toEntity(data);
}

export async function updateStatus(id: string, status: Boleto['status']): Promise<Boleto> {
  const { data, error } = await supabase
    .from('boletos')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return toEntity(data);
}
