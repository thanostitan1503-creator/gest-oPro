import { db, generateId } from '../db';
import type { ShiftStockAudit, WorkShift } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';

type SessionUser = {
  id?: string;
  nome?: string;
  depositoId?: string;
};

export const getSessionUser = (): SessionUser | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('gp_session');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    return {
      id: parsed?.id,
      nome: parsed?.nome,
      depositoId: parsed?.depositoId,
    };
  } catch {
    return null;
  }
};

export async function getOpenShiftForUser(userId: string, depositId: string): Promise<WorkShift | null> {
  const open = await db.work_shifts
    .where('status')
    .equals('OPEN')
    .filter((s) => s.user_id === userId && s.deposit_id === depositId)
    .first();
  return open ?? null;
}

export async function openShift(params: {
  userId: string;
  userName?: string;
  depositId: string;
  openingBalance: number;
  notes?: string | null;
}): Promise<WorkShift> {
  const now = Date.now();
  const shift: WorkShift = {
    id: generateId(),
    user_id: params.userId,
    user_name: params.userName ?? null,
    deposit_id: params.depositId,
    status: 'OPEN',
    opened_at: now,
    opening_balance: Number(params.openingBalance ?? 0) || 0,
    notes: params.notes ?? null,
  };

  const openingEntryId = generateId();
  const openingEntry = {
    id: openingEntryId,
    shift_id: shift.id,
    deposit_id: shift.deposit_id,
    user_id: shift.user_id,
    user_name: shift.user_name ?? null,
    category: 'OPENING_BALANCE',
    direction: 'IN',
    amount: shift.opening_balance,
    status: 'POSTED',
    created_at: now,
    payment_type: 'cash',
    notes: 'Abertura de caixa',
  };

  await db.transaction('rw', db.work_shifts, db.cash_flow_entries, db.outbox_events, async () => {
    await db.work_shifts.put(shift);
    await db.cash_flow_entries.put(openingEntry as any);
    await enqueueOutboxEvent({
      entity: 'work_shifts',
      action: 'UPSERT',
      entity_id: shift.id,
      payload_json: shift,
    });
    await enqueueOutboxEvent({
      entity: 'cash_flow_entries',
      action: 'UPSERT',
      entity_id: openingEntryId,
      payload_json: openingEntry,
    });
  });

  return shift;
}

export async function closeShift(params: {
  shift: WorkShift;
  status: WorkShift['status'];
  declared: { cash: number; card: number; pix: number };
  system: { cash: number; card: number; pix: number };
  notes?: string | null;
}): Promise<WorkShift> {
  const now = Date.now();
  const updated: WorkShift = {
    ...params.shift,
    status: params.status,
    closed_at: now,
    declared_cash: params.declared.cash,
    declared_card: params.declared.card,
    declared_pix: params.declared.pix,
    system_cash: params.system.cash,
    system_card: params.system.card,
    system_pix: params.system.pix,
    closing_balance: params.system.cash,
    notes: params.notes ?? params.shift.notes ?? null,
  };

  await db.transaction('rw', db.work_shifts, db.outbox_events, async () => {
    await db.work_shifts.put(updated);
    await enqueueOutboxEvent({
      entity: 'work_shifts',
      action: 'UPSERT',
      entity_id: updated.id,
      payload_json: updated,
    });
  });

  return updated;
}

export async function saveShiftStockAudits(audits: ShiftStockAudit[]) {
  if (!audits.length) return;
  await db.transaction('rw', db.shift_stock_audits, db.outbox_events, async () => {
    await db.shift_stock_audits.bulkPut(audits);
    for (const audit of audits) {
      await enqueueOutboxEvent({
        entity: 'shift_stock_audits',
        action: 'UPSERT',
        entity_id: audit.id,
        payload_json: audit,
      });
    }
  });
}
