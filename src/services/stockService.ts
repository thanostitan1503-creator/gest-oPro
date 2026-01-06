/**
 * 📊 STOCK SERVICE
 * 
 * Camada de serviço para operações de Estoque.
 * Implementa REGRA DE OURO: Saldo é SEMPRE calculado (nunca armazenado fixo).
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Atalhos de tipos
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
export type NewStockMovement = Database['public']['Tables']['stock_movements']['Insert'];
export type StockBalance = Database['public']['Tables']['stock_balance']['Row'];

/**
 * Tipo de Movimento de Estoque
 */
export type StockMovementOrigin = 
  | 'SALE'           // Venda
  | 'PURCHASE'       // Compra
  | 'TRADE_IN'       // Entrada de vazio (troca)
  | 'LOSS'           // Perda
  | 'ADJUSTMENT'     // Ajuste manual
  | 'TRANSFER_OUT'   // Transferência saída
  | 'TRANSFER_IN'    // Transferência entrada
  | 'CARGA_INICIAL'; // Carga inicial (diferente de ajuste)

/**
 * Service Pattern para Stock
 */
export const stockService = {
  /**
   * 1. Calcular saldo atual de um produto em um depósito
   * REGRA DE OURO: Saldo = SUM(quantity) de stock_movements
   */
  async getBalance(productId: string, depositId: string): Promise<number> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('quantity')
      .eq('product_id', productId)
      .eq('deposit_id', depositId);
    
    if (error) throw new Error(`Erro ao calcular saldo: ${error.message}`);
    
    // Soma todos os movimentos (positivos e negativos)
    return (data || []).reduce((sum, mov) => sum + mov.quantity, 0);
  },

  /**
   * 2. Obter saldo de todos os produtos de um depósito
   */
  async getBalancesByDeposit(depositId: string): Promise<Map<string, number>> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('product_id, quantity')
      .eq('deposit_id', depositId);
    
    if (error) throw new Error(`Erro ao buscar saldos: ${error.message}`);
    
    // Agrupa por produto_id
    const balances = new Map<string, number>();
    (data || []).forEach(mov => {
      const current = balances.get(mov.product_id) || 0;
      balances.set(mov.product_id, current + mov.quantity);
    });
    
    return balances;
  },

  /**
   * 3. Registrar movimento de estoque
   * 
   * @param movement - Dados do movimento
   * @returns O movimento criado
   * 
   * @example
   * // Venda de 1 Gás P13
   * await stockService.addMovement({
   *   product_id: 'uuid-gas-p13',
   *   deposit_id: 'uuid-deposito-matriz',
   *   quantity: -1,
   *   type: 'OUT',
   *   origin: 'SALE',
   *   reference_id: 'uuid-ordem-servico'
   * });
   */
  async addMovement(movement: NewStockMovement): Promise<StockMovement> {
    const { data, error } = await supabase
      .from('stock_movements')
      .insert(movement)
      .select()
      .single();

    if (error) throw new Error(`Erro ao registrar movimento: ${error.message}`);
    return data;
  },

  /**
   * 4. Registrar múltiplos movimentos (transação atômica)
   * Útil para vendas com múltiplos itens ou transferências
   */
  async addMovements(movements: NewStockMovement[]): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .insert(movements)
      .select();

    if (error) throw new Error(`Erro ao registrar movimentos: ${error.message}`);
    return data || [];
  },

  /**
   * 5. Listar movimentos de um produto em um depósito
   */
  async getMovements(
    productId: string,
    depositId: string,
    limit: number = 100
  ): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .eq('deposit_id', depositId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw new Error(`Erro ao listar movimentos: ${error.message}`);
    return data || [];
  },

  /**
   * 6. Carga inicial de estoque
   * Diferente de ajuste - usado na primeira vez que se configura o depósito
   */
  async loadInitialStock(
    productId: string,
    depositId: string,
    quantity: number,
    reason: string = 'Carga inicial do sistema'
  ): Promise<StockMovement> {
    return await this.addMovement({
      product_id: productId,
      deposit_id: depositId,
      quantity: quantity,
      type: quantity >= 0 ? 'IN' : 'OUT',
      origin: 'CARGA_INICIAL',
      reason
    });
  },

  /**
   * 7. Ajuste de estoque (diferente de carga inicial)
   * Usado para corrigir discrepâncias após contagem
   */
  async adjustStock(
    productId: string,
    depositId: string,
    newQuantity: number,
    reason: string
  ): Promise<StockMovement> {
    // Calcula diferença entre saldo atual e novo
    const currentBalance = await this.getBalance(productId, depositId);
    const difference = newQuantity - currentBalance;

    if (difference === 0) {
      throw new Error('Saldo já está correto, nenhum ajuste necessário');
    }

    return await this.addMovement({
      product_id: productId,
      deposit_id: depositId,
      quantity: difference,
      type: difference > 0 ? 'IN' : 'OUT',
      origin: 'ADJUSTMENT',
      reason
    });
  },

  // ==================== TRANSFERÊNCIAS ====================

  /**
   * 8. Transferir estoque entre depósitos
   */
  async transfer(
    productId: string,
    fromDepositId: string,
    toDepositId: string,
    quantity: number,
    notes?: string
  ): Promise<{ from: StockMovement; to: StockMovement }> {
    // Valida saldo de origem
    const balanceFrom = await this.getBalance(productId, fromDepositId);
    if (balanceFrom < quantity) {
      throw new Error(`Saldo insuficiente no depósito de origem (disponível: ${balanceFrom})`);
    }

    // Cria movimentos (saída e entrada)
    const [from, to] = await this.addMovements([
      {
        product_id: productId,
        deposit_id: fromDepositId,
        quantity: -quantity,
        type: 'OUT',
        origin: 'TRANSFER_OUT',
        reason: notes || `Transferência para outro depósito`
      },
      {
        product_id: productId,
        deposit_id: toDepositId,
        quantity: quantity,
        type: 'IN',
        origin: 'TRANSFER_IN',
        reason: notes || `Transferência de outro depósito`
      }
    ]);

    return { from, to };
  },

  // ==================== CONTAGEM DE ESTOQUE ====================

  /**
   * 9. Criar sessão de contagem
   */
  async createStockCount(depositId: string, userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('stock_counts')
      .insert({
        deposit_id: depositId,
        status: 'ABERTA',
        created_by: userId
      })
      .select('id')
      .single();

    if (error) throw new Error(`Erro ao criar contagem: ${error.message}`);
    return data.id;
  },

  /**
   * 10. Adicionar item à contagem
   */
  async addCountItem(
    countId: string,
    productId: string,
    systemQuantity: number,
    countedQuantity: number
  ): Promise<void> {
    const { error } = await supabase
      .from('stock_count_items')
      .insert({
        count_id: countId,
        product_id: productId,
        system_quantity: systemQuantity,
        counted_quantity: countedQuantity,
        difference: countedQuantity - systemQuantity
      });

    if (error) throw new Error(`Erro ao adicionar item: ${error.message}`);
  },

  /**
   * 11. Finalizar contagem (aplica ajustes)
   */
  async finalizeStockCount(countId: string): Promise<void> {
    // Busca itens da contagem
    const { data: items, error: itemsError } = await supabase
      .from('stock_count_items')
      .select('*, stock_counts(deposit_id)')
      .eq('count_id', countId);

    if (itemsError) throw new Error(`Erro ao buscar itens: ${itemsError.message}`);

    // Para cada item com diferença, cria movimento de ajuste
    const movements: NewStockMovement[] = [];
    for (const item of items || []) {
      if (item.difference !== 0) {
        movements.push({
          product_id: item.product_id,
          deposit_id: (item.stock_counts as any).deposit_id,
          quantity: item.difference,
          type: item.difference > 0 ? 'IN' : 'OUT',
          origin: 'ADJUSTMENT',
          reason: `Ajuste por contagem (ID: ${countId})`,
          reference_id: countId
        });
      }
    }

    // Registra movimentos
    if (movements.length > 0) {
      await this.addMovements(movements);
    }

    // Marca contagem como concluída
    const { error: updateError } = await supabase
      .from('stock_counts')
      .update({ 
        status: 'CONCLUIDA',
        completed_at: new Date().toISOString()
      })
      .eq('id', countId);

    if (updateError) throw new Error(`Erro ao finalizar contagem: ${updateError.message}`);
  },

  // ==================== RELATÓRIOS ====================

  /**
   * 12. Produtos com estoque baixo
   */
  async getLowStockProducts(depositId: string, threshold: number = 5): Promise<Array<{
    product_id: string;
    balance: number;
  }>> {
    const balances = await this.getBalancesByDeposit(depositId);
    
    return Array.from(balances.entries())
      .filter(([_, balance]) => balance <= threshold)
      .map(([product_id, balance]) => ({ product_id, balance }));
  },

  /**
   * 13. Histórico de movimentos por período
   */
  async getMovementsByPeriod(
    depositId: string,
    startDate: string,
    endDate: string
  ): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('deposit_id', depositId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Erro ao buscar movimentos: ${error.message}`);
    return data || [];
  }
};
