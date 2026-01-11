/**
 * 🛒 SERVICE ORDER SERVICE
 * 
 * Camada de serviço para Ordens de Serviço (Vendas/PDV).
 * Implementa TODA a lógica de venda: itens, pagamentos, estoque, delivery.
 */

import { supabase } from '@/utils/supabaseClient';
import { Database } from '../types/supabase';
import { stockService } from './stockService';

// Atalhos de tipos
export type ServiceOrder = Database['public']['Tables']['service_orders']['Row'];
export type NewServiceOrder = Database['public']['Tables']['service_orders']['Insert'];
export type ServiceOrderItem = Database['public']['Tables']['service_order_items']['Row'];
export type NewServiceOrderItem = Database['public']['Tables']['service_order_items']['Insert'];
export type ServiceOrderPayment = Database['public']['Tables']['service_order_payments']['Row'];
export type NewServiceOrderPayment = Database['public']['Tables']['service_order_payments']['Insert'];

/**
 * Tipo completo de O.S. com itens e pagamentos
 */
export interface CompleteServiceOrder extends ServiceOrder {
  items: ServiceOrderItem[];
  payments: ServiceOrderPayment[];
}

/**
 * Dados para criar O.S. completa
 */
export interface CreateServiceOrderData {
  order: NewServiceOrder;
  items: NewServiceOrderItem[];
  payments: NewServiceOrderPayment[];
}

/**
 * Service Pattern para Service Orders
 */
export const serviceOrderService = {
  /**
   * Upsert simples da O.S. (somente tabela service_orders).
   * Usado quando a tela ja gerencia itens/pagamentos separadamente.
   */
  async upsertRecord(order: NewServiceOrder): Promise<void> {
    const { error } = await supabase.from('service_orders').upsert(order);
    if (error) throw new Error(`Erro ao salvar O.S.: ${error.message}`);
  },

  /**
   * Upsert da O.S. com itens e pagamentos, sem movimentos de estoque.
   */
  async upsertWithDetails(data: CreateServiceOrderData): Promise<void> {
    const { order, items, payments } = data;
    const orderId = order.id;

    if (!orderId) {
      throw new Error('O.S. sem id para salvar itens/pagamentos.');
    }

    const { error: orderError } = await supabase
      .from('service_orders')
      .upsert(order);
    if (orderError) throw new Error(`Erro ao salvar O.S.: ${orderError.message}`);

    const { error: deleteItemsError } = await supabase
      .from('service_order_items')
      .delete()
      .eq('order_id', orderId);
    if (deleteItemsError) {
      throw new Error(`Erro ao limpar itens da O.S.: ${deleteItemsError.message}`);
    }

    if (items.length > 0) {
      const itemsWithOrderId = items.map((item) => ({
        ...item,
        order_id: orderId,
      }));
      const { error: itemsError } = await supabase
        .from('service_order_items')
        .insert(itemsWithOrderId);
      if (itemsError) throw new Error(`Erro ao salvar itens da O.S.: ${itemsError.message}`);
    }

    const { error: deletePaymentsError } = await supabase
      .from('service_order_payments')
      .delete()
      .eq('order_id', orderId);
    if (deletePaymentsError) {
      throw new Error(`Erro ao limpar pagamentos da O.S.: ${deletePaymentsError.message}`);
    }

    if (payments.length > 0) {
      const paymentsWithOrderId = payments.map((payment) => ({
        ...payment,
        order_id: orderId,
      }));
      const { error: paymentsError } = await supabase
        .from('service_order_payments')
        .insert(paymentsWithOrderId);
      if (paymentsError) {
        throw new Error(`Erro ao salvar pagamentos da O.S.: ${paymentsError.message}`);
      }
    }
  },

  /**
   * Atualiza apenas o status da O.S.
   */
  async updateStatus(id: string, status: ServiceOrder['status']): Promise<ServiceOrder> {
    const payload: ServiceOrder['Update'] = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'CONCLUIDA') {
      payload.completed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('service_orders')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
    return data as ServiceOrder;
  },

  /**
   * Conclui a O.S. e aplica movimentos de estoque.
   */
  async complete(id: string): Promise<ServiceOrder> {
    const order = await this.getById(id);
    if (!order) throw new Error('O.S. nao encontrada');
    const { count, error: movementError } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('reference_id', id);
    if (movementError) {
      throw new Error(`Erro ao validar movimentos de estoque: ${movementError.message}`);
    }
    const hasMovements = (count ?? 0) > 0;

    const updated =
      order.status === 'CONCLUIDA' ? order : await this.updateStatus(id, 'CONCLUIDA');

    if (!hasMovements) {
      await this._createStockMovements(updated, order.items);
    }

    return updated;
  },
  /**
   * 1. Criar O.S. completa (venda + itens + pagamentos + movimentos de estoque)
   * 
   * ⚠️ IMPORTANTE: Esta operação é ATÔMICA. Se algo falhar, nada é salvo.
   * 
   * Fluxo:
   * 1. Insere service_order
   * 2. Insere service_order_items
   * 3. Insere service_order_payments
   * 4. Cria movimentos de estoque
   * 5. Se DELIVERY, cria delivery_job
   */
  async create(data: CreateServiceOrderData): Promise<CompleteServiceOrder> {
    // 1. Cria O.S.
    const { data: order, error: orderError } = await supabase
      .from('service_orders')
      .insert(data.order)
      .select()
      .single();

    if (orderError) throw new Error(`Erro ao criar O.S.: ${orderError.message}`);

    try {
      // 2. Cria itens
      const itemsWithOrderId = data.items.map(item => ({
        ...item,
        service_order_id: order.id
      }));

      const { data: items, error: itemsError } = await supabase
        .from('service_order_items')
        .insert(itemsWithOrderId)
        .select();

      if (itemsError) throw itemsError;

      // 3. Cria pagamentos
      const paymentsWithOrderId = data.payments.map(payment => ({
        ...payment,
        service_order_id: order.id
      }));

      const { data: payments, error: paymentsError } = await supabase
        .from('service_order_payments')
        .insert(paymentsWithOrderId)
        .select();

      if (paymentsError) throw paymentsError;

      // 4. Cria movimentos de estoque
      await this._createStockMovements(order, items || []);

      // 5. Se DELIVERY, cria delivery_job
      if (order.service_type === 'DELIVERY') {
        await this._createDeliveryJob(order.id);
      }

      return {
        ...order,
        items: items || [],
        payments: payments || []
      };
    } catch (error: any) {
      // Rollback: deleta a O.S. (cascata vai deletar itens/pagamentos)
      await supabase.from('service_orders').delete().eq('id', order.id);
      throw new Error(`Erro ao processar venda: ${error.message}`);
    }
  },

  /**
   * 2. Buscar O.S. por ID (com itens e pagamentos)
   */
  async getById(id: string): Promise<CompleteServiceOrder | null> {
    const { data: order, error: orderError } = await supabase
      .from('service_orders')
      .select(`
        *,
        items:service_order_items(*),
        payments:service_order_payments(*)
      `)
      .eq('id', id)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar O.S.: ${orderError.message}`);
    }

    return order as CompleteServiceOrder;
  },

  /**
   * 3. Listar O.S. de um depósito (paginado)
   */
  async getByDeposit(
    depositId: string,
    options?: {
      status?: ServiceOrder['status'];
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ServiceOrder[]> {
    let query = supabase
      .from('service_orders')
      .select('*')
      .eq('deposit_id', depositId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Erro ao listar O.S.: ${error.message}`);
    return data || [];
  },

  /**
   * 4. Cancelar O.S. (estorna estoque)
   */
  async cancel(id: string, reason: string): Promise<ServiceOrder> {
    // Busca O.S. com itens
    const order = await this.getById(id);
    if (!order) throw new Error('O.S. nao encontrada');
    if (order.status === 'CANCELADA') throw new Error('O.S. ja cancelada');

    const { count, error: movementError } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('reference_id', id);
    if (movementError) {
      throw new Error(`Erro ao validar movimentos de estoque: ${movementError.message}`);
    }

    // Estorna estoque somente se houve movimento
    if ((count ?? 0) > 0) {
      await this._reverseStockMovements(order, order.items);
    }

    // Estorna contas a receber
    const { error: receivablesError } = await supabase
      .from('accounts_receivable')
      .delete()
      .eq('order_id', id);
    if (receivablesError) {
      throw new Error(`Erro ao estornar recebiveis: ${receivablesError.message}`);
    }

    // Remove pagamentos da O.S.
    const { error: paymentsError } = await supabase
      .from('service_order_payments')
      .delete()
      .eq('order_id', id);
    if (paymentsError) {
      throw new Error(`Erro ao estornar pagamentos: ${paymentsError.message}`);
    }

    // Remove lancamentos de caixa vinculados
    const { error: cashFlowError } = await supabase
      .from('cash_flow_entries')
      .delete()
      .eq('reference_id', id);
    if (cashFlowError) {
      throw new Error(`Erro ao estornar caixa: ${cashFlowError.message}`);
    }

    // Remove delivery job se existir
    const { error: deliveryError } = await supabase
      .from('delivery_jobs')
      .delete()
      .eq('service_order_id', id);
    if (deliveryError) {
      throw new Error(`Erro ao remover delivery job: ${deliveryError.message}`);
    }

    // Atualiza status
    const { data, error } = await supabase
      .from('service_orders')
      .update({ 
        status: 'CANCELADA',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao cancelar O.S.: ${error.message}`);
    return data;
  },

  /**
   * 5. Atualizar status de entrega
   */
  async updateDeliveryStatus(
    id: string,
    deliveryStatus: ServiceOrder['delivery_status']
  ): Promise<ServiceOrder> {
    const { data, error } = await supabase
      .from('service_orders')
      .update({ 
        delivery_status: deliveryStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
    return data;
  },

  /**
   * 6. Atribuir entregador
   */
  async assignDriver(id: string, driverId: string): Promise<ServiceOrder> {
    const { data, error } = await supabase
      .from('service_orders')
      .update({ 
        driver_id: driverId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atribuir entregador: ${error.message}`);
    return data;
  },

  // ==================== RELATÓRIOS ====================

  /**
   * 7. Vendas do dia
   */
  async getTodaySales(depositId: string): Promise<{
    count: number;
    total: number;
    orders: ServiceOrder[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = today.toISOString();

    const orders = await this.getByDeposit(depositId, {
      status: 'CONCLUIDA',
      startDate
    });

    return {
      count: orders.length,
      total: orders.reduce((sum, o) => sum + o.total, 0),
      orders
    };
  },

  /**
   * 8. Vendas por período
   */
  async getSalesByPeriod(
    depositId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    count: number;
    total: number;
    orders: ServiceOrder[];
  }> {
    const orders = await this.getByDeposit(depositId, {
      status: 'CONCLUIDA',
      startDate,
      endDate
    });

    return {
      count: orders.length,
      total: orders.reduce((sum, o) => sum + o.total, 0),
      orders
    };
  },

  /**
   * 9. Top produtos vendidos
   */
  async getTopProducts(
    depositId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<Array<{
    product_id: string;
    quantity: number;
    revenue: number;
  }>> {
    const { data, error } = await supabase
      .from('service_order_items')
      .select(`
        product_id,
        quantity,
        unit_price,
        service_orders!inner(deposit_id, created_at, status)
      `)
      .eq('service_orders.deposit_id', depositId)
      .eq('service_orders.status', 'CONCLUIDA')
      .gte('service_orders.created_at', startDate)
      .lte('service_orders.created_at', endDate);

    if (error) throw new Error(`Erro ao buscar produtos: ${error.message}`);

    // Agrupa por produto
    const products = new Map<string, { quantity: number; revenue: number }>();
    (data || []).forEach(item => {
      const current = products.get(item.product_id) || { quantity: 0, revenue: 0 };
      products.set(item.product_id, {
        quantity: current.quantity + item.quantity,
        revenue: current.revenue + (item.quantity * item.unit_price)
      });
    });

    // Ordena por quantidade e limita
    return Array.from(products.entries())
      .map(([product_id, stats]) => ({ product_id, ...stats }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  },

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Cria movimentos de estoque baseado nos itens da O.S.
   */
  async _createStockMovements(
    order: ServiceOrder,
    items: ServiceOrderItem[]
  ): Promise<void> {
    for (const item of items) {
      // Busca produto para saber movement_type
      const { data: product } = await supabase
        .from('products')
        .select('movement_type, return_product_id, track_stock')
        .eq('id', item.product_id)
        .single();

      if (!product?.track_stock) continue; // Não rastreia estoque

      // Modo efetivo: sale_movement_type do item OU movement_type do produto
      const effectiveMode = item.sale_movement_type || product.movement_type;

      // Movimento de SAÍDA (sempre acontece)
      await stockService.addMovement({
        product_id: item.product_id,
        deposit_id: order.deposit_id,
        quantity: -item.quantity,
        type: 'OUT',
        origin: 'SALE',
        reference_id: order.id,
        reason: `Venda O.S. ${order.order_number}`
      });

      // Se EXCHANGE: movimento de ENTRADA do vazio
      if (effectiveMode === 'EXCHANGE' && product.return_product_id) {
        await stockService.addMovement({
          product_id: product.return_product_id,
          deposit_id: order.deposit_id,
          quantity: item.quantity,
          type: 'IN',
          origin: 'TRADE_IN',
          reference_id: order.id,
          reason: `Troca de casco - O.S. ${order.order_number}`
        });
      }
    }
  },

  /**
   * Estorna movimentos de estoque (cancelamento)
   */
  async _reverseStockMovements(
    order: ServiceOrder,
    items: ServiceOrderItem[]
  ): Promise<void> {
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('movement_type, return_product_id, track_stock')
        .eq('id', item.product_id)
        .single();

      if (!product?.track_stock) continue;

      const effectiveMode = item.sale_movement_type || product.movement_type;

      // ENTRADA do produto (estorna saída)
      await stockService.addMovement({
        product_id: item.product_id,
        deposit_id: order.deposit_id,
        quantity: item.quantity,
        type: 'IN',
        origin: 'ADJUSTMENT',
        reference_id: order.id,
        reason: `Cancelamento O.S. ${order.order_number}`
      });

      // Se tinha EXCHANGE: SAÍDA do vazio (estorna entrada)
      if (effectiveMode === 'EXCHANGE' && product.return_product_id) {
        await stockService.addMovement({
          product_id: product.return_product_id,
          deposit_id: order.deposit_id,
          quantity: -item.quantity,
          type: 'OUT',
          origin: 'ADJUSTMENT',
          reference_id: order.id,
          reason: `Cancelamento troca - O.S. ${order.order_number}`
        });
      }
    }
  },

  /**
   * Cria delivery_job para O.S. de entrega
   */
  async _createDeliveryJob(serviceOrderId: string): Promise<void> {
    const { error } = await supabase
      .from('delivery_jobs')
      .insert({
        service_order_id: serviceOrderId,
        status: 'CRIADA'
      });

    if (error) throw error;
  }
};
