import { db, generateId } from '../db';
import { OrdemServico, ItemOrdemServico } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { listProducts } from './products.repo';
import { applyMovements, hasMovementsForReference } from './stock.repo';
import { calcularMovimentosEstoque } from '../stock.logic';
import { listPaymentMethods } from './paymentMethods.repo';
import { createReceivable, deleteReceivablesByOs, listReceivablesByOs } from './receivables.repo';
import { registerCashFlow } from './cashflow.repo';

interface ItemOrdemServicoDB extends ItemOrdemServico {
  osId: string;
}

export async function listServiceOrders(): Promise<OrdemServico[]> {
  return db.service_orders.orderBy('dataHoraCriacao').reverse().toArray();
}

export async function getServiceOrder(id: string): Promise<OrdemServico | undefined> {
  return db.service_orders.get(id);
}

export async function upsertServiceOrder(os: OrdemServico): Promise<OrdemServico> {
  const withId: OrdemServico = os.id
    ? { ...os, updated_at: Date.now() }
    : { ...os, id: generateId(), dataHoraCriacao: Date.now(), updated_at: Date.now(), historico: os.historico ?? [] };

  const items: ItemOrdemServicoDB[] = (withId.itens || []).map((item) => ({
    ...item,
    id: item.id || generateId(),
    osId: withId.id,
  }));

  await db.transaction('rw', db.service_orders, db.service_order_items, db.outbox_events, async () => {
    await db.service_orders.put(withId);
    await db.service_order_items.where('osId').equals(withId.id).delete();
    if (items.length > 0) {
      await db.service_order_items.bulkPut(items);
    }

    await enqueueOutboxEvent({
      entity: 'service_orders',
      action: 'UPSERT',
      entity_id: withId.id,
      payload_json: withId,
    });
  });

  if (withId.status === 'CONCLUIDA') {
    const already = await hasMovementsForReference(withId.id, 'OS');
    if (!already) {
      const produtos = await listProducts();
      const movimentos = calcularMovimentosEstoque(withId, produtos, 'OS', false).map((m) => ({
        ...m,
        referenciaId: withId.id,
        usuarioId: 'Sistema',
        usuarioNome: 'Sistema',
        motivo: 'Conclusao de O.S',
      }));
      if (movimentos.length) await applyMovements(movimentos);
    }
  }

  return withId;
}

export async function deleteServiceOrder(id: string) {
  await db.transaction('rw', db.service_orders, db.service_order_items, db.outbox_events, async () => {
    await db.service_orders.delete(id);
    await db.service_order_items.where('osId').equals(id).delete();

    await enqueueOutboxEvent({
      entity: 'service_orders',
      action: 'DELETE',
      entity_id: id,
    });
  });
}

export async function updateServiceOrderStatus(osId: string, status: OrdemServico['status'], motivo?: string, usuario = 'Sistema') {
  const order = await db.service_orders.get(osId);
  if (!order) return undefined;

  const prevStatus = order.status;

  const historico = order.historico || [];
  historico.unshift({
    data: Date.now(),
    usuario,
    acao: 'Mudança de Status',
    detalhe: `Para ${status}${motivo ? ` (${motivo})` : ''}`
  });

  const updated: OrdemServico = {
    ...order,
    status,
    updated_at: Date.now(),
    dataHoraConclusao: status === 'CONCLUIDA' ? new Date() : order.dataHoraConclusao,
    historico,
  };
  const resolvedDepositId =
    updated.depositoId ??
    (updated as any).deposito_id ??
    (updated as any).depositId ??
    (updated as any).deposit_id ??
    null;
  if (!updated.depositoId && resolvedDepositId) {
    updated.depositoId = resolvedDepositId as any;
  }

  await db.transaction('rw', db.service_orders, db.outbox_events, async () => {
    await db.service_orders.put(updated);
    await enqueueOutboxEvent({
      entity: 'service_orders',
      action: 'UPSERT',
      entity_id: updated.id,
      payload_json: updated,
    });
  });

  // =============================
  // STOCK LEDGER (offline-first)
  // =============================
  // Regra: estoque só é impactado quando a O.S é CONCLUIDA.
  // - Ao CONCLUIR: gera movimentos com origem 'OS'.
  // - Ao CANCELAR uma O.S já CONCLUIDA: gera movimentos inversos com origem 'OS_CANCELAMENTO'.
  // Idempotência: se já existirem movimentos para (referenciaId=osId, origem), não reaplica.

  if (status === 'CONCLUIDA' && prevStatus !== 'CONCLUIDA') {
    const already = await hasMovementsForReference(updated.id, 'OS');
    if (!already) {
      const produtos = await listProducts();
      const itens = (updated.itens && updated.itens.length > 0)
        ? updated.itens
        : await listItemsByOrder(updated.id);
      const osForStock = itens && itens.length ? { ...updated, itens } : updated;
      const movimentos = calcularMovimentosEstoque(osForStock, produtos, 'OS', false).map((m) => ({
        ...m,
        referenciaId: updated.id,
        usuarioId: usuario,
        usuarioNome: usuario,
        motivo: m.motivo ?? motivo ?? 'Conclusão de O.S',
      }));
      if (movimentos.length) await applyMovements(movimentos);
    }
  }

  // ==================================
  // FINANCEIRO: CONTAS A RECEBER (term)
  // ==================================
  // Regra: pagamentos APRAZO com geraContasReceber=true entram em accounts_receivable.
  // Idempotência: se já existir recebível para (os_id + payment_method_id), não recria.

  if (status === 'CONCLUIDA' && prevStatus !== 'CONCLUIDA') {
    try {
      const methods = await listPaymentMethods();
      const existing = await listReceivablesByOs(updated.id);

      for (const pag of updated.pagamentos ?? []) {
        const methodId =
          (pag as any).formaPagamentoId ??
          (pag as any).payment_method_id ??
          (pag as any).paymentMethodId;
        const paymentAmount = Number((pag as any).valor ?? (pag as any).amount ?? (pag as any).value ?? 0) || 0;
        if (paymentAmount > 0) {
          const method = methods.find((m) => m.id === methodId);
          const receiptType = method?.receipt_type ?? 'other';
          const paymentType =
            receiptType === 'cash'
              ? 'cash'
              : receiptType === 'card'
                ? 'card'
                : receiptType === 'pix'
                  ? 'pix'
                  : 'other';

          await registerCashFlow({
            category: 'SALE',
            amount: paymentAmount,
            direction: 'IN',
            referenceId: updated.id,
            referenceType: 'OS',
            paymentMethodId: methodId ?? null,
            paymentType,
            notes: updated.numeroOs ? `OS #${updated.numeroOs}` : 'OS',
            depositId: resolvedDepositId ? String(resolvedDepositId) : undefined,
            userName: usuario,
          });
        }

        if (!methodId) continue;
        const method = methods.find((m) => m.id === methodId);
        if (!method) continue;
        const isBoleto = method.receipt_type === 'boleto';
        const generatesReceivable = method.enters_receivables || isBoleto;
        if (!generatesReceivable) continue;

        const already = existing.some((r) => r.payment_method_id === method.id);
        if (already) continue;

        const prazoDias = Number(method.default_due_days ?? (isBoleto ? 3 : 30));
        const now = Date.now();
        const vencimentoEm = now + prazoDias * 24 * 60 * 60 * 1000;

        await createReceivable({
          os_id: updated.id,
          payment_method_id: method.id,
          deposit_id: resolvedDepositId ? String(resolvedDepositId) : null,
          description: updated.numeroOs ? `OS #${updated.numeroOs}` : updated.description ?? null,
          devedor_nome: updated.clienteNome,
          client_id: (updated as any).clienteId ?? (updated as any).client_id ?? null,
          requires_boleto: isBoleto,
          valor_total: paymentAmount,
          status: 'ABERTO',
          criado_em: now,
          vencimento_em: vencimentoEm,
        });
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('RECEIVABLES_GENERATION_FAIL', { osId: updated.id, error: e });
      }
    }
  }

  if (status === 'CANCELADA' && prevStatus === 'CONCLUIDA') {
    const alreadyCancel = await hasMovementsForReference(updated.id, 'OS_CANCELAMENTO');
    if (!alreadyCancel) {
      const hasOriginal = await hasMovementsForReference(updated.id, 'OS');
      if (!hasOriginal) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('STOCK_CANCEL_SKIP_NO_ORIGINAL', { osId: updated.id });
        }
      } else {
        const produtos = await listProducts();
        const itens = (updated.itens && updated.itens.length > 0)
          ? updated.itens
          : await listItemsByOrder(updated.id);
        const osForStock = itens && itens.length ? { ...updated, itens } : updated;
        const movimentos = calcularMovimentosEstoque(osForStock, produtos, 'OS_CANCELAMENTO', true).map((m) => ({
          ...m,
          referenciaId: updated.id,
          usuarioId: usuario,
          usuarioNome: usuario,
          motivo: m.motivo ?? motivo ?? 'Cancelamento de O.S',
        }));
        if (movimentos.length) await applyMovements(movimentos);
      }
    }

    // Remove contas a receber ligadas à O.S (best-effort)
    try {
      await deleteReceivablesByOs(updated.id);
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('RECEIVABLES_CANCEL_FAIL', { osId: updated.id, error: e });
      }
    }
  }

  return updated;
}

export async function listItemsByOrder(osId: string): Promise<ItemOrdemServico[]> {
  return db.service_order_items.where('osId').equals(osId).toArray();
}
