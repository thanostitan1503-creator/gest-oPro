export type BoletoStatus = 'PENDENTE' | 'GERADO' | 'ENVIADO' | 'PAGO' | 'CANCELADO';

export interface Boleto {
  id: string;
  receivable_id: string | null;
  amount: number;
  bank_name?: string | null;
  barcode?: string | null;
  digitable_line?: string | null;
  pdf_url?: string | null;
  status?: BoletoStatus | null;
  due_date?: string | null;
  issue_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
