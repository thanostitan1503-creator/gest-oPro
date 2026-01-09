import { db, generateId } from '../db';
import type { Produto } from '../types';

/**
 * Persists a new product. If no id is provided on the incoming object it
 * assigns a generated id. An outbox event is recorded for synchronisation.
 */
export async function createProduct(product: Produto): Promise<Produto> {
  const id = (product as any).id ?? generateId();
  const record: any = { ...product, id };
  await db.products.put(record);
  await db.outbox_events.put({
    id: generateId(),
    entity: 'products',
    entity_id: id,
    action: 'insert',
    created_at: Date.now(),
  });
  return record as Produto;
}

/**
 * Returns all products from the database.
 */
export async function listProducts(): Promise<Produto[]> {
  const all = await db.products.toArray();
  return all as any;
}
