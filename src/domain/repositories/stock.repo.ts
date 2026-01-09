import { db, generateId } from '../db';
import type { MovimentoEstoque } from '../types';

/**
 * Applies a stock movement to the in-memory store. Movements are logged to
 * the stock_movements table and also update the aggregate balance per
 * deposit/product. Entradas increase the quantity and Saidas decrease it.
 */
export async function applyMovement(movement: MovimentoEstoque): Promise<void> {
  // Persist the movement itself
  await db.stock_movements.put(movement as any);

  // Locate existing balance record
  const depositoId = (movement as any).depositoId;
  const produtoId = (movement as any).produtoId;
  let balance = await db.stock_balance
    .where('depositoId')
    .equals(depositoId)
    .and((r: any) => r.produtoId === produtoId)
    .first();

  const qtyChange = movement.tipo === 'ENTRADA' ? movement.quantidade : -movement.quantidade;

  if (balance) {
    balance.quantidade = (balance.quantidade ?? 0) + qtyChange;
    await db.stock_balance.put(balance);
  } else {
    balance = {
      id: generateId(),
      depositoId: depositoId,
      produtoId: produtoId,
      quantidade: qtyChange,
    };
    await db.stock_balance.put(balance);
  }

  // Record outbox for movement
  await db.outbox_events.put({
    id: generateId(),
    entity: 'stock_movements',
    entity_id: movement.id,
    action: 'insert',
    created_at: Date.now(),
  });
}

/**
 * Retrieves the current stock quantity for a given deposit and product.
 * Returns 0 if no balance record exists.
 */
export async function getStockQty(depositoId: string, produtoId: string): Promise<number> {
  const record = await db.stock_balance
    .where('depositoId')
    .equals(depositoId)
    .and((r: any) => r.produtoId === produtoId)
    .first();
  if (record) {
    return record.quantidade ?? 0;
  }
  return 0;
}
