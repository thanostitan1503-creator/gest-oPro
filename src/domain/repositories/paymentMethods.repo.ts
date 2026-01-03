import { db, generateId } from '../db';
import { PaymentMethod, Maquininha } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';

const normalizePaymentMethod = (method: PaymentMethod | any): PaymentMethod => {
  const now = new Date().toISOString();
  const id = method?.id ?? generateId();
  const created = method?.created_at ?? now;
  const receipt_type = (method?.receipt_type as PaymentMethod['receipt_type']) ?? 'other';
  const enters_receivables = (() => {
    if (receipt_type === 'cash' || receipt_type === 'pix') return false;
    if (typeof method?.enters_receivables === 'boolean') return method.enters_receivables;
    // Defaults: boleto/fiado entram em contas a receber.
    return receipt_type === 'boleto' || receipt_type === 'fiado';
  })();
  const default_due_days = enters_receivables ? Number(method?.default_due_days ?? 0) : 0;
  return {
    id,
    name: method?.name ?? method?.Nome ?? method?.nome ?? '',
    receipt_type,
    default_due_days,
    enters_receivables,
    machine_label: method?.machine_label ?? undefined,
    is_active: Boolean(method?.is_active ?? true),
    created_at: created,
    updated_at: method?.updated_at ?? now,
  };
};

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  return db.payment_methods.orderBy('name').toArray();
}

export async function upsertPaymentMethod(method: PaymentMethod): Promise<PaymentMethod> {
  const entity = normalizePaymentMethod(method);

  await db.transaction('rw', db.payment_methods, db.outbox_events, async () => {
    await db.payment_methods.put(entity);
    await enqueueOutboxEvent({
      entity: 'payment_methods',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });
  return entity;
}

export async function deletePaymentMethod(id: string) {
  await db.transaction('rw', db.payment_methods, db.outbox_events, async () => {
    await db.payment_methods.delete(id);
    await enqueueOutboxEvent({
      entity: 'payment_methods',
      action: 'DELETE',
      entity_id: id,
    });
  });
}

export async function listMachines(): Promise<Maquininha[]> {
  return db.machines.toArray();
}

export async function upsertMachine(machine: Maquininha): Promise<Maquininha> {
  const entity: Maquininha = machine.id ? machine : { ...machine, id: generateId() };
  await db.machines.put(entity);
  return entity;
}

export async function deleteMachine(id: string) {
  await db.machines.delete(id);
}
