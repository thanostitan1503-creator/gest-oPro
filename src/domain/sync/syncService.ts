import { db, OutboxEventRow } from '../db';
import { listSyncableOutboxEvents, markOutboxFailed, markOutboxSent } from './outbox';
import {
  applyDepositDelete,
  applyDepositUpsert,
  applyEmployeeDelete,
  applyEmployeeUpsert,
  applyProductDelete,
  applyProductUpsert,
  applyClientDelete,
  applyClientUpsert,
  applyClientPriceOverrideDelete,
  applyClientPriceOverrideUpsert,
  applyClientOneTimeDiscountDelete,
  applyClientOneTimeDiscountUpsert,
  applyServiceOrderDelete,
  applyServiceOrderUpsert,
  applyStockMovementDelete,
  applyStockMovementUpsert,
  applyPaymentMethodDelete,
  applyPaymentMethodUpsert,
  applyAccountsReceivableDelete,
  applyAccountsReceivableUpsert,
  applyReceivablePaymentDelete,
  applyReceivablePaymentUpsert,
  applyExpenseDelete,
  applyExpenseUpsert,
  applyFinancialSettingsDelete,
  applyFinancialSettingsUpsert,
  applyWorkShiftDelete,
  applyWorkShiftUpsert,
  applyCashFlowEntryDelete,
  applyCashFlowEntryUpsert,
  applyShiftStockAuditDelete,
  applyShiftStockAuditUpsert,
  applyDeliveryZoneDelete,
  applyDeliveryZoneUpsert,
  applyDeliverySectorDelete,
  applyDeliverySectorUpsert,
  applyZonePricingDelete,
  applyZonePricingUpsert,
  applyProductPricingDelete,
  applyProductPricingUpsert,
  applyProductExchangeRuleDelete,
  applyProductExchangeRuleUpsert,
} from './supabaseAppliers';

let started = false;
let syncing = false;
let intervalId: number | undefined;

function isOnline() {
  // navigator pode não existir em SSR, mas aqui é SPA.
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

async function applyEvent(event: OutboxEventRow) {
  switch (event.entity) {
    case 'products':
      if (event.action === 'DELETE') return applyProductDelete(event.entity_id);
      return applyProductUpsert(event.payload_json);

    case 'deposits':
      if (event.action === 'DELETE') return applyDepositDelete(event.entity_id);
      return applyDepositUpsert(event.payload_json);

    case 'employees':
      if (event.action === 'DELETE') return applyEmployeeDelete(event.entity_id);
      return applyEmployeeUpsert(event.payload_json);

    case 'clients':
      if (event.action === 'DELETE') return applyClientDelete(event.entity_id);
      return applyClientUpsert(event.payload_json);

    case 'client_price_overrides':
      if (event.action === 'DELETE') return applyClientPriceOverrideDelete(event.entity_id);
      return applyClientPriceOverrideUpsert(event.payload_json);

    case 'client_one_time_discount':
      if (event.action === 'DELETE') return applyClientOneTimeDiscountDelete(event.entity_id);
      return applyClientOneTimeDiscountUpsert(event.payload_json);

    case 'service_orders':
      if (event.action === 'DELETE') return applyServiceOrderDelete(event.entity_id);
      return applyServiceOrderUpsert(event.payload_json);

    case 'stock_movements':
      if (event.action === 'DELETE') return applyStockMovementDelete(event.entity_id);
      return applyStockMovementUpsert(event.payload_json);

    case 'payment_methods':
      if (event.action === 'DELETE') return applyPaymentMethodDelete(event.entity_id);
      return applyPaymentMethodUpsert(event.payload_json);

    case 'receivables':
    case 'accounts_receivable':
      if (event.action === 'DELETE') return applyAccountsReceivableDelete(event.entity_id);
      return applyAccountsReceivableUpsert(event.payload_json);

    case 'financial_settings':
      if (event.action === 'DELETE') return applyFinancialSettingsDelete(event.entity_id);
      return applyFinancialSettingsUpsert(event.payload_json);

    case 'receivable_payments':
      if (event.action === 'DELETE') return applyReceivablePaymentDelete(event.entity_id);
      return applyReceivablePaymentUpsert(event.payload_json);

    case 'expenses':
      if (event.action === 'DELETE') return applyExpenseDelete(event.entity_id);
      return applyExpenseUpsert(event.payload_json);

    case 'work_shifts':
      if (event.action === 'DELETE') return applyWorkShiftDelete(event.entity_id);
      return applyWorkShiftUpsert(event.payload_json);

    case 'cash_flow_entries':
      if (event.action === 'DELETE') return applyCashFlowEntryDelete(event.entity_id);
      return applyCashFlowEntryUpsert(event.payload_json);

    case 'shift_stock_audits':
      if (event.action === 'DELETE') return applyShiftStockAuditDelete(event.entity_id);
      return applyShiftStockAuditUpsert(event.payload_json);

    case 'delivery_zones':
      if (event.action === 'DELETE') return applyDeliveryZoneDelete(event.entity_id);
      return applyDeliveryZoneUpsert(event.payload_json);

    case 'delivery_zones':
      if (event.action === 'DELETE') return applyDeliverySectorDelete(event.entity_id);
      return applyDeliverySectorUpsert(event.payload_json);

    case 'zone_pricing':
      if (event.action === 'DELETE') return applyZonePricingDelete(event.entity_id);
      return applyZonePricingUpsert(event.payload_json);

    case 'zone_pricing':
      if (event.action === 'DELETE') return applyProductPricingDelete(event.entity_id);
      return applyProductPricingUpsert(event.payload_json);

    case 'product_exchange_rules':
      if (event.action === 'DELETE') return applyProductExchangeRuleDelete(event.entity_id);
      return applyProductExchangeRuleUpsert(event.payload_json);

    default:
      // Entidade ainda não suportada no sync (mantém na fila como FAILED para visibilidade)
      throw new Error(`Outbox entity not supported yet: ${event.entity}`);
  }
}

export async function syncNow(options?: { limit?: number; log?: boolean }) {
  if (syncing) return;
  if (!isOnline()) return;

  syncing = true;
  const limit = options?.limit ?? 50;
  const log = options?.log ?? false;

  try {
    // Garante que a DB está aberta antes de sincronizar
    await db.open();

    const events = await listSyncableOutboxEvents(limit);
    if (log && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('SYNC_OUTBOX_START', { count: events.length });
    }

    for (const ev of events) {
      try {
        await applyEvent(ev);
        await markOutboxSent(ev.id);
      } catch (e) {
        await markOutboxFailed(ev.id, e);
        if (log && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('SYNC_OUTBOX_FAIL', { id: ev.id, entity: ev.entity, action: ev.action, error: e });
        }
      }
    }

    if (log && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('SYNC_OUTBOX_DONE');
    }
  } finally {
    syncing = false;
  }
}

export function startSyncService() {
  if (started) return;
  started = true;

  // Dispara uma sync assim que possível
  if (isOnline()) void syncNow({ log: true });

  // Quando voltar internet, sincroniza
  window.addEventListener('online', () => {
    void syncNow({ log: true });
  });

  // Polling leve quando online (evita ficar preso se um evento falhar e depois “destravar”)
  intervalId = window.setInterval(() => {
    if (!isOnline()) return;
    void syncNow({ log: false });
  }, 10_000);
}

export function stopSyncService() {
  if (!started) return;
  if (intervalId) window.clearInterval(intervalId);
  intervalId = undefined;
  started = false;
}
