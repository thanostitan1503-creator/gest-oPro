import { db, generateId } from '../db';
import type { OrdemServico } from '../types';
import { listProducts } from './products.repo';
import { calcularMovimentosEstoque } from '../stock.logic';
import { applyMovement } from './stock.repo';

/**
 * Inserts or updates a service order. When an order is marked as CONCLUIDA
 * the corresponding stock movements are generated and applied. Each item is
 * stored separately in the service_order_items table for future reference.
 */
export async function upsertServiceOrder(order: OrdemServico): Promise<OrdemServico> {
  // Persist the OS itself
  await db.service_orders.put(order as any);

  // Persist each item linked to the OS
  if (Array.isArray(order.itens)) {
    for (const item of order.itens) {
      const record: any = { ...item, orderId: order.id };
      await db.service_order_items.put(record);
    }
  }

  // Record outbox event
  await db.outbox_events.put({
    id: generateId(),
    entity: 'service_orders',
    entity_id: order.id,
    action: 'upsert',
    created_at: Date.now(),
  });

  // If the order is concluded, generate and apply stock movements
  if (order.status === 'CONCLUIDA') {
    const produtos = await listProducts();
    const movimentos = calcularMovimentosEstoque(order, produtos as any, 'OS' as any, false);
    for (const movimento of movimentos) {
      await applyMovement(movimento);
    }
  }
  return order;
}
