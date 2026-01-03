import { db, generateId, AccountsReceivable, ReceivablePayment } from '../db';
import { TituloReceber } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';

export async function createReceivable(payload: Omit<AccountsReceivable, 'id' | 'valor_pago'>) {
  const now = Date.now();
  const row: AccountsReceivable = {
    id: generateId(),
    os_id: payload.os_id ?? null,
    payment_method_id: payload.payment_method_id ?? null,
    deposit_id: payload.deposit_id ?? null,
    devedor_nome: payload.devedor_nome ?? payload.description ?? 'Cliente',
    valor_total: Number(payload.valor_total ?? 0),
    valor_pago: 0,
    status: payload.status ?? 'ABERTO',
    criado_em: payload.criado_em ?? now,
    vencimento_em: payload.vencimento_em ?? now,
    description: payload.description ?? null,
    client_id: payload.client_id ?? null,
    requires_boleto: payload.requires_boleto ?? false,
    is_personal: payload.is_personal ?? false,
    alert_days_before: payload.alert_days_before ?? undefined,
    installment_no: payload.installment_no,
    installments_total: payload.installments_total,
  };

  await db.transaction('rw', db.accounts_receivable, db.outbox_events, async () => {
    await db.accounts_receivable.put(row);
    await enqueueOutboxEvent({
      entity: 'accounts_receivable',
      action: 'UPSERT',
      entity_id: row.id,
      payload_json: row,
    });
  });

  return row;
}

export async function listReceivablesByOs(osId: string) {
  return db.accounts_receivable.where('os_id').equals(osId).toArray();
}

export async function deleteReceivable(id: string) {
  await db.transaction('rw', db.accounts_receivable, db.outbox_events, async () => {
    await db.accounts_receivable.delete(id);
    await enqueueOutboxEvent({
      entity: 'accounts_receivable',
      action: 'DELETE',
      entity_id: id,
    });
  });
}

export async function deleteReceivablesByOs(osId: string) {
  const rows = await listReceivablesByOs(osId);
  if (!rows.length) return;

  await db.transaction('rw', db.accounts_receivable, db.outbox_events, async () => {
    for (const r of rows) {
      await db.accounts_receivable.delete(r.id);
      await enqueueOutboxEvent({
        entity: 'accounts_receivable',
        action: 'DELETE',
        entity_id: r.id,
      });
    }
  });
}

export async function listReceivables(status?: AccountsReceivable['status']) {
  if (!status) return db.accounts_receivable.toArray();
  return db.accounts_receivable.where('status').equals(status).toArray();
}

export async function addReceivablePayment(
  receivableId: string,
  valor: number,
  usuarioId: string,
  paymentMethodId?: string | null,
  paidAtMs?: number,
  obs?: string | null
) {
  const receivable = await db.accounts_receivable.get(receivableId);
  if (!receivable) throw new Error('Recebível não encontrado');

  const payment: ReceivablePayment = {
    id: generateId(),
    receivable_id: receivableId,
    valor,
    data_hora: paidAtMs ?? Date.now(),
    usuario_id: usuarioId,
    payment_method_id: paymentMethodId ?? null,
    obs: obs ?? null,
  };

  const novoValorPago = (receivable.valor_pago || 0) + valor;
  const status: AccountsReceivable['status'] =
    novoValorPago >= receivable.valor_total ? 'PAGO' : 'PARCIAL';

  const updatedReceivable: AccountsReceivable = {
    ...receivable,
    valor_pago: novoValorPago,
    status,
  };

  await db.transaction('rw', db.accounts_receivable, db.receivable_payments, db.outbox_events, async () => {
    await db.receivable_payments.put(payment);
    await db.accounts_receivable.update(receivableId, { valor_pago: novoValorPago, status });

    await enqueueOutboxEvent({
      entity: 'receivable_payments',
      action: 'UPSERT',
      entity_id: payment.id,
      payload_json: payment,
    });
    await enqueueOutboxEvent({
      entity: 'accounts_receivable',
      action: 'UPSERT',
      entity_id: updatedReceivable.id,
      payload_json: updatedReceivable,
    });
  });

  return payment;
}

export async function updateReceivablePayment(
  paymentId: string,
  patch: Partial<ReceivablePayment>,
  usuarioId: string
) {
  const current = await db.receivable_payments.get(paymentId);
  if (!current) throw new Error('Pagamento não encontrado');

  const receivable = await db.accounts_receivable.get(current.receivable_id);
  if (!receivable) throw new Error('Recebível não encontrado');

  const nextPayment: ReceivablePayment = { ...current, ...patch };

  const delta = (nextPayment.valor ?? 0) - (current.valor ?? 0);
  const novoValorPago = (receivable.valor_pago || 0) + delta;
  const status: AccountsReceivable['status'] =
    novoValorPago >= receivable.valor_total ? 'PAGO' : novoValorPago > 0 ? 'PARCIAL' : receivable.status;

  const updatedReceivable: AccountsReceivable = {
    ...receivable,
    valor_pago: novoValorPago,
    status,
  };

  await db.transaction('rw', db.receivable_payments, db.accounts_receivable, db.outbox_events, async () => {
    await db.receivable_payments.put(nextPayment);
    await db.accounts_receivable.put(updatedReceivable);

    await enqueueOutboxEvent({
      entity: 'receivable_payments',
      action: 'UPSERT',
      entity_id: nextPayment.id,
      payload_json: nextPayment,
    });
    await enqueueOutboxEvent({
      entity: 'accounts_receivable',
      action: 'UPSERT',
      entity_id: updatedReceivable.id,
      payload_json: updatedReceivable,
    });
  });

  return nextPayment;
}

export async function listReceivablePayments(receivableId: string) {
  return db.receivable_payments.where('receivable_id').equals(receivableId).toArray();
}

export async function updateReceivable(id: string, patch: Partial<AccountsReceivable>) {
  const existing = await db.accounts_receivable.get(id);
  if (!existing) throw new Error('Recebível não encontrado');
  const next: AccountsReceivable = { ...existing, ...patch };

  await db.transaction('rw', db.accounts_receivable, db.outbox_events, async () => {
    await db.accounts_receivable.put(next);
    await enqueueOutboxEvent({
      entity: 'accounts_receivable',
      action: 'UPSERT',
      entity_id: next.id,
      payload_json: next,
    });
  });

  return next;
}

export async function saveReceivableTitle(title: TituloReceber) {
  const row: TituloReceber = title.id ? title : { ...title, id: generateId() };
  await db.receivable_titles.put(row);
  return row;
}

export async function listReceivableTitles() {
  return db.receivable_titles.toArray();
}
