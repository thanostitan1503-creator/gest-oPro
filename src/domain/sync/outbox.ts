import { db, generateId, OutboxAction, OutboxEntity, OutboxEventRow, OutboxStatus } from '../db';

export type EnqueueOutboxParams = {
  entity: OutboxEntity;
  action: OutboxAction;
  entity_id: string;
  payload_json?: any;
  status?: OutboxStatus;
};

export async function enqueueOutboxEvent(params: EnqueueOutboxParams) {
  const now = Date.now();
  const row: OutboxEventRow = {
    id: generateId(),
    entity: params.entity,
    action: params.action,
    entity_id: params.entity_id,
    payload_json: params.payload_json,
    created_at: now,
    updated_at: now,
    status: params.status ?? 'PENDING',
    attempts: 0,
  };
  await db.outbox_events.put(row);
  return row;
}

export async function listSyncableOutboxEvents(limit = 50) {
  // Pega PENDING primeiro e depois FAILED (para retry), limitando tentativas.
  const pending = await db.outbox_events
    .where('status')
    .equals('PENDING')
    .sortBy('created_at');

  if (pending.length >= limit) return pending.slice(0, limit);

  const remaining = limit - pending.length;
  const failed = await db.outbox_events
    .where('status')
    .equals('FAILED')
    .filter((e) => e.attempts < 10)
    .sortBy('created_at');

  return pending.concat(failed.slice(0, remaining));
}

export async function markOutboxSent(id: string) {
  const now = Date.now();
  await db.outbox_events.update(id, {
    status: 'SENT',
    updated_at: now,
    synced_at: now,
    last_error: undefined,
  });
}

export async function markOutboxFailed(id: string, error: unknown) {
  const now = Date.now();
  const msg = error instanceof Error ? error.message : String(error);

  await db.transaction('rw', db.outbox_events, async () => {
    const current = await db.outbox_events.get(id);
    if (!current) return;
    await db.outbox_events.update(id, {
      status: 'FAILED',
      updated_at: now,
      attempts: (current.attempts ?? 0) + 1,
      last_error: msg,
    });
  });
}
