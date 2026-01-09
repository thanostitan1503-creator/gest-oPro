import { db, generateId } from '../db';
import type { Deposit } from '../types';

/**
 * Inserts or updates a deposit record. When called repeatedly with the same
 * id the existing record will be replaced. An outbox event is emitted.
 */
export async function upsertDeposit(deposit: Deposit): Promise<Deposit> {
  await db.deposits.put(deposit as any);
  await db.outbox_events.put({
    id: generateId(),
    entity: 'deposits',
    entity_id: deposit.id,
    action: 'upsert',
    created_at: Date.now(),
  });
  return deposit;
}
