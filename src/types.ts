// Tipos canônicos alinhados ao schema atual do banco

export interface PaymentMethod {
  id: string;
  name: string;
  receipt_type: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other';
  enters_receivables: boolean;
  default_due_days: number;
  is_active: boolean;
  machine_label?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export type Produto = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao?: string | null;
  tipo?: string | null;
  unidade?: string | null;
  product_group?: string | null;
  imagem_url?: string | null;
  type?: string | null;
  depositoId?: string | null; // ✅ Padrão único (camelCase)

  preco_custo: number;
  preco_venda: number;
  preco_padrao: number;
  marcacao: number;

  track_stock?: boolean;
  is_delivery_fee?: boolean;
  movement_type?: string | null;
  return_product_id?: string | null;
  tracks_empties: boolean;
  ativo: boolean;
  current_stock?: number | null;
  min_stock?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

export type Receivable = {
  id: string;
  os_id?: string | null;
  sale_payment_id?: string | null;
  payment_method_id?: string | null;
  requires_boleto?: boolean;
  client_id?: string | null;
  depositoId?: string | null; // ✅ Padrão único (camelCase)
  description?: string | null;
  devedor_nome?: string | null;
  valor_total: number;
  valor_pago: number;
  status: 'ABERTO' | 'PARCIAL' | 'PAGO' | 'VENCIDO';
  vencimento_em: number; // timestamp (ms)
  criado_em: number; // timestamp (ms)
  installment_no?: number;
  installments_total?: number;
  is_personal?: boolean;
  alert_days_before?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

// --- Despesas ---
export type ExpenseStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  due_date: string; // Formato YYYY-MM-DD
  paid_date?: string | null; // Formato ISO se pago
  status: ExpenseStatus;
  category: string; // 'FIXA', 'VARIAVEL', 'SALARIO'
  is_fixed: boolean;
  depositoId?: string | null; // ✅ Padrão único (camelCase)
  alert_days_before: number; // 0, 1, 2, 3...
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FinancialSettings {
  id: string;
  monthly_goal: number;
  updated_at?: string | null;
}
