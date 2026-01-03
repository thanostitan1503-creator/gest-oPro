import { db, generateId } from '../db';
import type {
  CashFlowEntry,
  CashFlowEntryCategory,
  CashFlowEntryDirection,
  CashFlowEntryStatus,
} from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { getOpenShiftForUser, getSessionUser } from './shift.repo';

const directionByCategory: Record<CashFlowEntryCategory, CashFlowEntryDirection> = {
  OPENING_BALANCE: 'IN',
  SALE: 'IN',
  SUPRIMENTO: 'IN',
  SANGRIA: 'OUT',
  ADJUSTMENT: 'IN',
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export async function createCashFlowEntry(entry: CashFlowEntry): Promise<CashFlowEntry> {
  await db.transaction('rw', db.cash_flow_entries, db.outbox_events, async () => {
    await db.cash_flow_entries.put(entry);
    await enqueueOutboxEvent({
      entity: 'cash_flow_entries',
      action: 'UPSERT',
      entity_id: entry.id,
      payload_json: entry,
    });
  });
  return entry;
}

export async function registerCashFlow(params: {
  shiftId?: string | null;
  depositId?: string | null;
  userId?: string | null;
  userName?: string | null;
  category: CashFlowEntryCategory;
  amount: number | string;
  direction?: CashFlowEntryDirection;
  status?: CashFlowEntryStatus;
  referenceId?: string | null;
  referenceType?: string | null;
  paymentMethodId?: string | null;
  paymentType?: 'cash' | 'card' | 'pix' | 'other';
  notes?: string | null;
  meta?: any;
  occurredAt?: number;
}): Promise<CashFlowEntry | null> {
  const session = getSessionUser();
  const userId = params.userId ?? session?.id ?? null;
  const userName = params.userName ?? session?.nome ?? null;
  const depositId = params.depositId ?? session?.depositoId ?? null;
  if (!userId || !depositId) return null;

  const shiftId = params.shiftId ?? (await getOpenShiftForUser(userId, depositId))?.id ?? null;
  if (!shiftId) return null;

  const amount = Math.abs(toNumber(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (params.referenceId) {
    const existing = await db.cash_flow_entries
      .where('reference_id')
      .equals(params.referenceId)
      .filter((e) =>
        e.shift_id === shiftId &&
        e.category === params.category &&
        (params.paymentMethodId ? e.payment_method_id === params.paymentMethodId : true)
      )
      .first();
    if (existing) return existing as CashFlowEntry;
  }

  const createdAt = params.occurredAt ?? Date.now();
  const entry: CashFlowEntry = {
    id: generateId(),
    shift_id: shiftId,
    deposit_id: depositId,
    user_id: userId,
    user_name: userName,
    category: params.category,
    direction: params.direction ?? directionByCategory[params.category],
    amount,
    status: params.status ?? 'POSTED',
    created_at: createdAt,
    reference_id: params.referenceId ?? null,
    reference_type: params.referenceType ?? null,
    payment_method_id: params.paymentMethodId ?? null,
    payment_type: params.paymentType ?? (params.category === 'SALE' ? 'other' : 'cash'),
    notes: params.notes ?? null,
    meta: params.meta ?? null,
  };

  return createCashFlowEntry(entry);
}
