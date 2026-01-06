/**
 * 💰 FINANCIAL SERVICE
 * 
 * Serviço para operações financeiras: contas a receber, despesas, caixa.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export type AccountsReceivable = Database['public']['Tables']['accounts_receivable']['Row'];
export type NewAccountsReceivable = Database['public']['Tables']['accounts_receivable']['Insert'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type NewExpense = Database['public']['Tables']['expenses']['Insert'];
export type WorkShift = Database['public']['Tables']['work_shifts']['Row'];
export type NewWorkShift = Database['public']['Tables']['work_shifts']['Insert'];

export const financialService = {
  // ==================== CONTAS A RECEBER ====================

  /**
   * 1. Listar contas a receber pendentes
   */
  async getPendingReceivables(depositId?: string): Promise<AccountsReceivable[]> {
    let query = supabase
      .from('accounts_receivable')
      .select('*')
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
   * 2. Criar conta a receber
   */
  async createReceivable(receivable: NewAccountsReceivable): Promise<AccountsReceivable> {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .insert(receivable)
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar recebível: ${error.message}`);
    return data;
  },

  /**
   * 3. Marcar como pago
   */
  async markReceivableAsPaid(
    id: string,
    paymentMethodId: string,
    amount: number
  ): Promise<void> {
    // Atualiza status
    const { error: updateError } = await supabase
      .from('accounts_receivable')
      .update({
        status: 'PAGO',
        paid_date: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw new Error(`Erro ao atualizar: ${updateError.message}`);

    // Registra pagamento
    const { error: paymentError } = await supabase
      .from('receivable_payments')
      .insert({
        receivable_id: id,
        amount,
        payment_method_id: paymentMethodId,
        paid_at: new Date().toISOString()
      });

    if (paymentError) throw new Error(`Erro ao registrar pagamento: ${paymentError.message}`);
  },

  /**
   * 4. Contas vencidas (atualiza status automaticamente)
   */
  async getOverdueReceivables(depositId?: string): Promise<AccountsReceivable[]> {
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('accounts_receivable')
      .select('*')
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
      .single();

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
      })
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
      .single();

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
      .single();

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
      .single();

    if (fetchError) throw new Error(`Erro ao buscar turno: ${fetchError.message}`);
    if (shift.status !== 'OPEN') throw new Error('Turno já está fechado');

    // Calcula valores do sistema (busca vendas do turno)
    const { data: orders } = await supabase
      .from('service_orders')
      .select(`
        *,
        payments:service_order_payments(*, payment_methods(type))
      `)
      .eq('deposit_id', shift.deposit_id)
      .gte('created_at', shift.opened_at);

    let systemCash = 0, systemCard = 0, systemPix = 0;
    (orders || []).forEach((order: any) => {
      order.payments.forEach((payment: any) => {
        const type = payment.payment_methods?.type;
        if (type === 'cash') systemCash += payment.amount;
        if (type === 'card') systemCard += payment.amount;
        if (type === 'pix') systemPix += payment.amount;
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
      .single();

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
      .select('amount')
      .eq('deposit_id', depositId)
      .eq('status', 'PENDENTE')
      .eq('due_date', today);

    const receivablesDue = (receivables || []).reduce((sum, r) => sum + r.amount, 0);

    return {
      revenue,
      expenses: totalExpenses,
      balance: revenue - totalExpenses,
      receivables_due: receivablesDue
    };
  }
};
