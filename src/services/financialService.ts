/**
 * 💰 FINANCIAL SERVICE
 * 
 * Serviço para operações financeiras: contas a receber, despesas, caixa.
 */

import { supabase } from '@/utils/supabaseClient';
import { Database } from '../types/supabase';

export type AccountsReceivable = Database['public']['Tables']['accounts_receivable']['Row'];
export type NewAccountsReceivable = Database['public']['Tables']['accounts_receivable']['Insert'];
export type UpdateAccountsReceivable = Database['public']['Tables']['accounts_receivable']['Update'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type NewExpense = Database['public']['Tables']['expenses']['Insert'];
export type CashFlowEntry = Database['public']['Tables']['cash_flow_entries']['Row'];
export type NewCashFlowEntry = Database['public']['Tables']['cash_flow_entries']['Insert'];
export type WorkShift = Database['public']['Tables']['work_shifts']['Row'];
export type NewWorkShift = Database['public']['Tables']['work_shifts']['Insert'];

const ACCOUNTS_RECEIVABLE_FIELDS =
  'id,order_id,deposit_id,client_id,client_name,original_amount,paid_amount,remaining_amount,status,due_date,notes,created_at,updated_at';
const normalizeDueDate = (value?: string | number | null) => {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value).toISOString().split('T')[0];
  return value;
};

export const financialService = {

  /**

  /**
   * 1. Listar contas a receber pendentes
   */
    async getPendingReceivables(depositId?: string): Promise<AccountsReceivable[]> {
    let query = supabase
      .from('accounts_receivable')
      .select(ACCOUNTS_RECEIVABLE_FIELDS)
      .eq('status', 'PENDENTE')
      .order('due_date');

    if (depositId) {
      query = query.eq('deposit_id', depositId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar recebíveis: ${error.message}`);
    return data || [];
  },

  /**
   * 1b. Listar contas a receber (geral)
   */
  async listReceivables(filters?: {
    depositId?: string;
    status?: string | string[];
    fromDueDate?: string;
    toDueDate?: string;
  }): Promise<AccountsReceivable[]> {
    let query = supabase
      .from('accounts_receivable')
      .select(ACCOUNTS_RECEIVABLE_FIELDS)
      .order('due_date');

    if (filters?.depositId) {
      query = query.eq('deposit_id', filters.depositId);
    }
    if (filters?.status) {
      query = Array.isArray(filters.status)
        ? query.in('status', filters.status)
        : query.eq('status', filters.status);
    }
    if (filters?.fromDueDate) {
      query = query.gte('due_date', filters.fromDueDate);
    }
    if (filters?.toDueDate) {
      query = query.lte('due_date', filters.toDueDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar receb」eis: ${error.message}`);
    return data || [];
  },

  /**
   * 2. Criar conta a receber
   */
  async createReceivable(receivable: NewAccountsReceivable): Promise<AccountsReceivable> {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .insert(receivable as Database['public']['Tables']['accounts_receivable']['Insert'])
      .select(ACCOUNTS_RECEIVABLE_FIELDS)
      .maybeSingle();

    if (error) throw new Error(`Erro ao criar recebível: ${error.message}`);
    return data;
  },

  /**
   * 3. Marcar como pago
   */
    async markReceivableAsPaid(
    id: string,
    amount: number,
    paidAt?: string | number | null
  ): Promise<void> {
    try {
      const { data: receivable, error: fetchError } = await supabase
        .from('accounts_receivable')
        .select('original_amount, paid_amount, remaining_amount, status')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!receivable) throw new Error('Conta a receber nao encontrada.');

      const original = Number(receivable.original_amount || 0);
      const currentPaid = Number(receivable.paid_amount || 0);
      const nextPaid = currentPaid + Number(amount || 0);
      const nextRemaining = Math.max(0, original - nextPaid);
      const nextStatus = nextRemaining <= 0 ? 'PAGO' : (receivable.status || 'PENDENTE');

      const update: UpdateAccountsReceivable = {
        paid_amount: nextPaid,
        remaining_amount: nextRemaining,
        status: nextStatus,
        updated_at: new Date().toISOString()
      };

      if (paidAt) {
        update.updated_at =
          typeof paidAt === 'number'
            ? new Date(paidAt).toISOString()
            : new Date(paidAt).toISOString();
      }

      const { error: updateError } = await supabase
        .from('accounts_receivable')
        .update(update)
        .eq('id', id);

      if (updateError) throw updateError;
    } catch (error: any) {
      throw new Error(`Erro ao registrar pagamento: ${error.message}`);
    }
  },

  /**
   * 4. Contas vencidas (atualiza status automaticamente)
   */
  async getOverdueReceivables(depositId?: string): Promise<AccountsReceivable[]> {
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('accounts_receivable')
      .select(ACCOUNTS_RECEIVABLE_FIELDS)
      .eq('status', 'PENDENTE')
      .lt('due_date', today)
      .order('due_date');

    if (depositId) {
      query = query.eq('deposit_id', depositId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar vencidos: ${error.message}`);

    // Atualiza status para ATRASADO
    if (data && data.length > 0) {
      const ids = data.map(r => r.id);
      await supabase
        .from('accounts_receivable')
        .update({ status: 'ATRASADO' })
        .in('id', ids);
    }

    return data || [];
  },

  /**
   * Atualiza campos de um recebível. Aceita keys legadas e mapeia para o schema canonical
   */
  async updateReceivable(
    id: string,
    patch: UpdateAccountsReceivable & {
      valor_total?: number;
      valor_pago?: number;
      vencimento_em?: number | string;
    }
  ): Promise<AccountsReceivable | null> {
    const update: UpdateAccountsReceivable = {};

    if (patch.valor_total !== undefined) update.original_amount = patch.valor_total;
    if (patch.valor_pago !== undefined) update.paid_amount = patch.valor_pago;
    if (patch.remaining_amount !== undefined) update.remaining_amount = patch.remaining_amount;
    if (patch.vencimento_em !== undefined) update.due_date = normalizeDueDate(patch.vencimento_em);
    if (patch.due_date !== undefined) update.due_date = normalizeDueDate(patch.due_date) ?? undefined;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.client_name !== undefined) update.client_name = patch.client_name;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.original_amount !== undefined) update.original_amount = patch.original_amount;
    if (patch.paid_amount !== undefined) update.paid_amount = patch.paid_amount;
    if (patch.order_id !== undefined) update.order_id = patch.order_id;
    if (patch.deposit_id !== undefined) update.deposit_id = patch.deposit_id;
    if (patch.client_id !== undefined) update.client_id = patch.client_id;

    if (Object.keys(update).length === 0) return null;
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('accounts_receivable')
      .update(update as UpdateAccountsReceivable)
      .eq('id', id)
      .select(ACCOUNTS_RECEIVABLE_FIELDS)
      .maybeSingle();

    if (error) throw new Error(`Erro ao atualizar recebível: ${error.message}`);
    return data || null;
  },

  /**
   * Lista recebíveis por depósito (wrapper)
   */
  async listReceivablesByDeposit(depositId?: string): Promise<AccountsReceivable[]> {
    return this.listReceivables({ depositId });
  },

  /**
   * Remover conta a receber
   */
  async deleteReceivable(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts_receivable')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Erro ao remover receb」el: ${error.message}`);
  },

  /**
   * Aplicar pagamento (sem historico detalhado)
   */
  async applyReceivablePayment(payload: {
    receivableId: string;
    amount: number;
    paidAt?: string | number | null;
  }): Promise<AccountsReceivable> {
    try {
      const amountValue = Number(payload.amount || 0);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        throw new Error('Valor de pagamento invalido');
      }

      const { data: receivable, error: fetchError } = await supabase
        .from('accounts_receivable')
        .select('original_amount, paid_amount, remaining_amount, status')
        .eq('id', payload.receivableId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!receivable) throw new Error('Conta a receber nao encontrada.');

      const original = Number(receivable.original_amount || 0);
      const currentPaid = Number(receivable.paid_amount || 0);
      const nextPaid = currentPaid + amountValue;
      const nextRemaining = Math.max(0, original - nextPaid);
      const nextStatus = nextRemaining <= 0 ? 'PAGO' : (receivable.status || 'PENDENTE');

      const update: UpdateAccountsReceivable = {
        paid_amount: nextPaid,
        remaining_amount: nextRemaining,
        status: nextStatus,
        updated_at: new Date().toISOString()
      };

      if (payload.paidAt) {
        update.updated_at =
          typeof payload.paidAt === 'number'
            ? new Date(payload.paidAt).toISOString()
            : new Date(payload.paidAt).toISOString();
      }

      const { data, error: updateError } = await supabase
        .from('accounts_receivable')
        .update(update)
        .eq('id', payload.receivableId)
        .select(ACCOUNTS_RECEIVABLE_FIELDS)
        .maybeSingle();

      if (updateError) throw updateError;
      if (!data) throw new Error('Pagamento nao aplicado.');
      return data;
    } catch (error: any) {
      throw new Error(`Erro ao aplicar pagamento: ${error.message}`);
    }
  },

  /**
   * Registrar movimento de caixa
   */
  async registerCashFlow(payload: {
    category: string;
    amount: number;
    direction: 'IN' | 'OUT';
    paymentType?: string | null;
    notes?: string | null;
    depositId: string | null;
    userId?: string | null;
    shiftId?: string | null;
  }): Promise<CashFlowEntry> {
    if (!payload.depositId) throw new Error('Deposito obrigatorio');

    const insert: NewCashFlowEntry = {
      amount: payload.amount,
      category: payload.category,
      direction: payload.direction,
      payment_method: payload.paymentType ?? null,
      description: payload.notes ?? null,
      deposit_id: payload.depositId,
      user_id: payload.userId ?? null,
      shift_id: payload.shiftId ?? null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('cash_flow_entries')
      .insert(insert as NewCashFlowEntry)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Erro ao registrar caixa: ${error.message}`);
    return data as CashFlowEntry;
  },

  // ==================== DESPESAS ====================

  /**
   * 5. Listar despesas pendentes
   */
  async getPendingExpenses(depositId?: string): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('status', 'PENDENTE')
      .order('due_date');

    if (depositId) {
      query = query.eq('deposit_id', depositId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar despesas: ${error.message}`);
    return data || [];
  },

  /**
   * 6. Criar despesa
   */
  async createExpense(expense: NewExpense): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Erro ao criar despesa: ${error.message}`);
    return data;
  },

  /**
   * 7. Marcar despesa como paga
   */
  async markExpenseAsPaid(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'PAGO',
        paid_date: new Date().toISOString()
      } as Database['public']['Tables']['expenses']['Update'])
      .eq('id', id);

    if (error) throw new Error(`Erro ao marcar como paga: ${error.message}`);
  },

  /**
   * 8. Despesas que vencem em X dias
   */
  async getExpensesDueSoon(days: number = 7, depositId?: string): Promise<Expense[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('status', 'PENDENTE')
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date');

    if (depositId) {
      query = query.eq('deposit_id', depositId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar despesas: ${error.message}`);
    return data || [];
  },

  // ==================== TURNOS (WORK SHIFTS) ====================

  /**
   * 9. Verificar se usuário tem turno aberto
   */
  async hasOpenShift(userId: string, depositId: string): Promise<WorkShift | null> {
    const { data, error } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('deposit_id', depositId)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao verificar turno: ${error.message}`);
    }

    return data || null;
  },

  /**
   * 10. Abrir turno
   */
  async openShift(userId: string, depositId: string, openingBalance: number): Promise<WorkShift> {
    // Valida se não há turno aberto
    const existing = await this.hasOpenShift(userId, depositId);
    if (existing) {
      throw new Error('Usuário já possui turno aberto neste depósito');
    }

    const { data, error } = await supabase
      .from('work_shifts')
      .insert({
        user_id: userId,
        deposit_id: depositId,
        opening_balance: openingBalance,
        opened_at: new Date().toISOString(),
        status: 'OPEN'
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(`Erro ao abrir turno: ${error.message}`);
    return data;
  },

  /**
   * 11. Fechar turno
   */
  async closeShift(
    shiftId: string,
    declared: {
      cash: number;
      card: number;
      pix: number;
    }
  ): Promise<WorkShift> {
    // Busca turno
    const { data: shift, error: fetchError } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('id', shiftId)
      .maybeSingle();

    if (fetchError) throw new Error(`Erro ao buscar turno: ${fetchError.message}`);
    if (shift.status !== 'OPEN') throw new Error('Turno já está fechado');

    // Calcula valores do sistema (busca vendas do turno)
    const { data: orders } = await supabase
      .from('service_orders')
      .select(`
        *,
        payments:service_order_payments(*)
      `)
      .eq('deposit_id', shift.deposit_id)
      .gte('created_at', shift.opened_at);

    let systemCash = 0, systemCard = 0, systemPix = 0;
    (orders || []).forEach((order: any) => {
      order.payments.forEach((payment: any) => {
        const method = payment.payment_method;
        if (method === 'cash') systemCash += payment.amount;
        if (method === 'card') systemCard += payment.amount;
        if (method === 'pix') systemPix += payment.amount;
      });
    });

    // Determina status (com ou sem discrepância)
    const hasDiscrepancy = 
      declared.cash !== systemCash ||
      declared.card !== systemCard ||
      declared.pix !== systemPix;

    const { data, error } = await supabase
      .from('work_shifts')
      .update({
        status: hasDiscrepancy ? 'DISCREPANCY' : 'CLOSED',
        closed_at: new Date().toISOString(),
        closing_balance: shift.opening_balance + declared.cash + declared.card + declared.pix,
        declared_cash: declared.cash,
        declared_card: declared.card,
        declared_pix: declared.pix,
        system_cash: systemCash,
        system_card: systemCard,
        system_pix: systemPix
      })
      .eq('id', shiftId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Erro ao fechar turno: ${error.message}`);
    return data;
  },

  // ==================== RELATÓRIOS ====================

  /**
   * 12. Resumo financeiro do dia
   */
  async getDailySummary(depositId: string): Promise<{
    revenue: number;
    expenses: number;
    balance: number;
    receivables_due: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Receita do dia
    const { data: orders } = await supabase
      .from('service_orders')
      .select('total')
      .eq('deposit_id', depositId)
      .eq('status', 'CONCLUIDA')
      .gte('created_at', today);

    const revenue = (orders || []).reduce((sum, o) => sum + o.total, 0);

    // Despesas pagas hoje
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('deposit_id', depositId)
      .eq('paid_date', today);

    const totalExpenses = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

    // Contas a receber que vencem hoje
    const { data: receivables } = await supabase
      .from('accounts_receivable')
      .select('remaining_amount, original_amount')
      .eq('deposit_id', depositId)
      .eq('status', 'PENDENTE')
      .eq('due_date', today);

    const receivablesDue = (receivables || []).reduce((sum, r) => {
      const remaining = Number(r.remaining_amount ?? r.original_amount ?? 0);
      return sum + (Number.isFinite(remaining) ? remaining : 0);
    }, 0);

    return {
      revenue,
      expenses: totalExpenses,
      balance: revenue - totalExpenses,
      receivables_due: receivablesDue
    };
  },

  /**
   * 13. Obter estatísticas do dashboard de auditoria via RPC
   * (Wrapper para o RPC get_audit_dashboard_stats)
   */
  async getAuditDashboardStats(targetDepositId?: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_audit_dashboard_stats', {
        target_deposit_id: targetDepositId ?? null,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      // Não propaga erro técnico diretamente - componente deve mostrar toast
      console.warn('financialService.getAuditDashboardStats failed', err);
      return null;
    }
  },
};



