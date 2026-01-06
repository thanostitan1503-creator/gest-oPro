import { db, generateId } from '../db';
import { Deposit } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDeposit } from '@/domain/utils/dataSanitizer';

export async function listDeposits(): Promise<Deposit[]> {
  const deposits = await db.deposits.toArray();
  return deposits.map(normalizeDeposit);
}

export async function getDeposit(id: string): Promise<Deposit | undefined> {
  const deposit = await db.deposits.get(id);
  return deposit ? normalizeDeposit(deposit) : undefined;
}

export async function upsertDeposit(deposit: Deposit): Promise<Deposit> {
  // ✅ Normaliza antes de salvar
  const cleanDeposit = normalizeDeposit(deposit);
  const entity: Deposit = cleanDeposit.id ? cleanDeposit : { ...cleanDeposit, id: generateId() };
  
  await db.transaction('rw', db.deposits, db.outbox_events, async () => {
    await db.deposits.put(entity);
    await enqueueOutboxEvent({
      entity: 'deposits',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });
  return entity;
}

export async function deleteDeposit(id: string) {
  await db.transaction('rw', db.deposits, db.outbox_events, async () => {
    await db.deposits.delete(id);
    await enqueueOutboxEvent({
      entity: 'deposits',
      action: 'DELETE',
      entity_id: id,
    });
  });
}
