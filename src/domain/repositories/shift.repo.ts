import { db, generateId } from '../db';
import type { WorkShift } from '../types';

/**
 * Opens a new work shift. Creates the shift record and a corresponding
 * cash flow entry for the opening balance. The status is always 'OPEN'.
 */
export async function openShift(params: {
  userId: string;
  userName?: string | null;
  depositId: string;
  openingBalance: number;
  notes?: string | null;
}): Promise<WorkShift> {
  const shift: any = {
    id: generateId(),
    depositoId: params.depositId,
    user_id: params.userId,
    user_name: params.userName ?? null,
    status: 'OPEN',
    opened_at: Date.now(),
    opening_balance: params.openingBalance,
    notes: params.notes ?? null,
  };
  await db.work_shifts.put(shift);

  // Register opening balance in cash flow
  await db.cash_flow_entries.put({
    id: generateId(),
    shift_id: shift.id,
    depositoId: params.depositId,
    user_id: params.userId,
    user_name: params.userName ?? null,
    category: 'OPENING_BALANCE',
    direction: 'IN',
    amount: params.openingBalance,
    status: 'POSTED',
    created_at: Date.now(),
    reference_id: null,
    reference_type: null,
    payment_method_id: null,
    payment_type: 'cash',
    notes: params.notes ?? null,
    meta: null,
  } as any);

  // Outbox event
  await db.outbox_events.put({
    id: generateId(),
    entity: 'work_shifts',
    entity_id: shift.id,
    action: 'open',
    created_at: Date.now(),
  });

  return shift as WorkShift;
}

/**
 * Closes an existing shift. Updates the shift status and declared/system
 * totals. A closing balance and timestamp are recorded. Returns the updated
 * shift.
 */
export async function closeShift(params: {
  shift: WorkShift;
  status: 'CLOSED' | 'DISCREPANCY';
  declared: { cash: number; card: number; pix: number };
  system: { cash: number; card: number; pix: number };
  notes?: string | null;
}): Promise<WorkShift> {
  const shift: any = params.shift;
  shift.status = params.status;
  shift.closed_at = Date.now();
  shift.declared_cash = params.declared.cash;
  shift.declared_card = params.declared.card;
  shift.declared_pix = params.declared.pix;
  shift.system_cash = params.system.cash;
  shift.system_card = params.system.card;
  shift.system_pix = params.system.pix;
  shift.closing_balance = params.system.cash;
  shift.notes = params.notes ?? null;

  await db.work_shifts.put(shift);

  await db.outbox_events.put({
    id: generateId(),
    entity: 'work_shifts',
    entity_id: shift.id,
    action: 'close',
    created_at: Date.now(),
  });

  return shift as WorkShift;
}

/**
 * Returns the first open shift for a given user and deposit. If none exist
 * returns undefined. Tests rely on this to enforce a single active shift.
 */
export async function getOpenShiftForUser(userId: string, depositId: string): Promise<WorkShift | undefined> {
  const openShift = await db.work_shifts
    .where('status')
    .equals('OPEN')
    .and((s: any) => s.user_id === userId && s.depositoId === depositId)
    .first();
  return openShift as any;
}
