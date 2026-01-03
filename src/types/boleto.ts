export type BoletoStatus = 'PENDENTE' | 'GERADO' | 'ENVIADO' | 'PAGO' | 'CANCELADO';

export interface Boleto {
  id: string;
  receivable_id: string;
  bank_name?: string | null;
  wallet?: string | null;
  our_number?: string | null;
  barcode?: string | null;
  digitable_line?: string | null;
  pdf_url?: string | null;
  status?: BoletoStatus;
  due_date?: string | null;
  created_at?: string | null;
}
