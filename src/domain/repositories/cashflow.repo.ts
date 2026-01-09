import { db, generateId } from '../db';
import type { CashFlowEntry } from '../types';

/**
 * Registers a cash flow entry. All values default as needed and the entry
 * status is set to POSTED. An outbox event is recorded for synchronisation.
 */
export async function registerCashFlow(params: {
  shiftId?: string;
  userId?: string;
  category: any;
  amount: number;
  direction: any;
  referenceId?: string;
  referenceType?: string;
  paymentMethodId?: string;
  paymentType?: 'cash' | 'card' | 'pix' | 'other';
  notes?: string;
  depositId?: string;
  userName?: string;
}): Promise<CashFlowEntry> {
  const entry: any = {
    id: generateId(),
    shift_id: params.shiftId ?? null,
    depositoId: params.depositId ?? '',
    user_id: params.userId ?? '',
    user_name: params.userName ?? null,
    category: params.category,
    direction: params.direction,
    amount: params.amount,
    status: 'POSTED',
    created_at: Date.now(),
    reference_id: params.referenceId ?? null,
    reference_type: params.referenceType ?? null,
    payment_method_id: params.paymentMethodId ?? null,
    payment_type: params.paymentType ?? 'cash',
    notes: params.notes ?? null,
    meta: null,
  };
  await db.cash_flow_entries.put(entry);
  await db.outbox_events.put({
    id: generateId(),
    entity: 'cash_flow_entries',
    entity_id: entry.id,
    action: 'insert',
    created_at: Date.now(),
  });
  return entry as CashFlowEntry;
}
