import { db, generateId, StockBalanceRow, StockTransfer, StockTransferItem } from '../db';
import { MovimentoEstoque } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDepositId } from '../../src/domain/utils/dataSanitizer';

function movementDelta(mov: MovimentoEstoque): number {
  switch (mov.tipo) {
    case 'ENTRADA':
      return mov.quantidade;
    case 'SUPRIMENTO_ENTRADA':
      return mov.quantidade;
    case 'SAIDA':
      return -mov.quantidade;
    case 'SANGRIA_SAIDA':
      return -mov.quantidade;
    case 'AJUSTE_CONTAGEM': {
      // AJUSTE_CONTAGEM usa quantidade absoluta; a direção vem da meta (quando disponível).
      const meta = mov.meta as any;
      const divergence = typeof meta?.divergence === 'number' ? meta.divergence : undefined;
      if (typeof divergence === 'number' && !Number.isNaN(divergence)) return divergence;

      const beforeQty = typeof meta?.beforeQty === 'number' ? meta.beforeQty : undefined;
      const afterQty = typeof meta?.afterQty === 'number' ? meta.afterQty : undefined;
      if (typeof beforeQty === 'number' && typeof afterQty === 'number') return afterQty - beforeQty;

      return 0;
    }
    default:
      return 0;
  }
}

export async function getStockMapForDeposit(depositId: string): Promise<Record<string, number>> {
  // Prefer stock_balance for current snapshot; fallback to movements if empty,
  // and finally fall back to the product's current_stock when no balance exists yet
  // (e.g., produto recém-criado com estoque inicial).
  const [rows, products] = await Promise.all([
    db.stock_balance.where('deposit_id').equals(depositId).toArray(),
    db.products.toArray(),
  ]);

  const map: Record<string, number> = {};

  if (rows.length) {
    rows.forEach((row) => {
      map[row.product_id] = Number(row.quantidade_atual ?? 0) || 0;
    });
  } else {
    const movements = await db.stock_movements.where('depositoId').equals(depositId).toArray();
    for (const mov of movements) {
      const current = map[mov.produtoId] ?? 0;
      const next = current + movementDelta(mov);
      map[mov.produtoId] = Math.max(0, next);
    }
  }

  // Preenche produtos que rastreiam estoque e ainda não têm saldo na tabela stock_balance
  const isTracked = (p: any) => {
    const trackFlag = p?.track_stock ?? p?.trackStock;
    const type = p?.type;
    const isDeliveryFee = p?.is_delivery_fee ?? p?.isDeliveryFee;
    if (trackFlag === false) return false;
    if (type === 'SERVICE') return false;
    if (isDeliveryFee) return false;
    return true;
  };

  for (const p of products) {
    if (!isTracked(p)) continue;
    const dep = (p as any).deposit_id ?? (p as any).depositId ?? (p as any).depositoId ?? null;
    if (dep && dep !== depositId) continue;

    if (map[p.id] === undefined || map[p.id] === null) {
      const fallbackQty = Number(
        (p as any).current_stock ??
        (p as any).quantidade_atual ??
        (p as any).estoque_atual ??
        0
      );
      map[p.id] = Math.max(0, fallbackQty || 0);
    }
  }

  return map;
}

export async function getStockQty(depositId: string, productId: string): Promise<number> {
  const map = await getStockMapForDeposit(depositId);
  return map[productId] ?? 0;
}

export async function hasMovementsForReference(referenciaId: string, origem?: MovimentoEstoque['origem']): Promise<boolean> {
  const first = await db.stock_movements
    .where('referenciaId')
    .equals(referenciaId)
    .filter((m) => (origem ? m.origem === origem : true))
    .first();
  return !!first;
}

export async function applyMovements(movements: MovimentoEstoque[], updateBalance = true) {
  const normalized: MovimentoEstoque[] = movements.map((m) => (m.id ? m : { ...m, id: generateId() }));

  const nowIso = new Date().toISOString();

  await db.transaction('rw', db.stock_movements, db.stock_balance, db.products, db.outbox_events, async () => {
    for (const mov of normalized) {
      await db.stock_movements.put(mov);

      if (updateBalance) {
        const current = await getBalance(mov.depositoId, mov.produtoId);
        const delta = movementDelta(mov);
        const nextQty = Math.max(0, (current?.quantidade_atual ?? 0) + delta);
        await setBalance(mov.depositoId, mov.produtoId, nextQty);

        const product = await db.products.get(mov.produtoId);
        if (product) {
          const productDeposit =
            (product as any).deposit_id ??
            (product as any).depositId ??
            (product as any).depositoId ??
            null;
          if (!productDeposit || productDeposit === mov.depositoId) {
            const prevStock =
              (product as any).current_stock ??
              (product as any).quantidade_atual;
            if (prevStock !== nextQty) {
              const updatedProduct = { ...product, current_stock: nextQty, updated_at: nowIso } as any;
              await db.products.put(updatedProduct);
              await enqueueOutboxEvent({
                entity: 'products',
                action: 'UPSERT',
                entity_id: updatedProduct.id,
                payload_json: updatedProduct,
              });
            }
          }
        }
      }

      await enqueueOutboxEvent({
        entity: 'stock_movements',
        action: 'UPSERT',
        entity_id: mov.id,
        payload_json: mov,
      });
    }
  });

  return normalized;
}

export async function listStockBalances(): Promise<StockBalanceRow[]> {
  return db.stock_balance.toArray();
}

export async function getBalance(depositId: string, productId: string): Promise<StockBalanceRow | undefined> {
  try {
    // Tenta usar o índice composto
    return await db.stock_balance
      .where('[deposit_id+product_id]')
      .equals([depositId, productId])
      .first();
  } catch (error) {
    // Fallback: busca manual se índice falhar
    const all = await db.stock_balance.toArray();
    return all.find(b => b.deposit_id === depositId && b.product_id === productId);
  }
}

export async function setBalance(depositId: string, productId: string, quantidade: number) {
  const existing = await getBalance(depositId, productId);
  const row: StockBalanceRow = existing
    ? { ...existing, quantidade_atual: quantidade }
    : { id: generateId(), deposit_id: depositId, product_id: productId, quantidade_atual: quantidade };
  await db.stock_balance.put(row);
  return row;
}

export async function applyMovement(movement: MovimentoEstoque, updateBalance = true) {
  const [mov] = await applyMovements([movement], updateBalance);
  return mov;
}

export async function listMovements(limit = 200): Promise<MovimentoEstoque[]> {
  return db.stock_movements.orderBy('dataHora').reverse().limit(limit).toArray();
}

export async function recordTransfer(transfer: Omit<StockTransfer, 'id' | 'criado_em'> & { criado_em?: number }, items: Omit<StockTransferItem, 'id' | 'transfer_id'>[]) {
  const transferRow: StockTransfer = {
    ...transfer,
    id: generateId(),
    criado_em: transfer.criado_em ?? Date.now(),
  };

  const itemRows: StockTransferItem[] = items.map((it) => ({
    ...it,
    id: generateId(),
    transfer_id: transferRow.id,
  }));

  await db.transaction('rw', db.stock_transfers, db.stock_transfer_items, async () => {
    await db.stock_transfers.put(transferRow);
    if (itemRows.length) await db.stock_transfer_items.bulkPut(itemRows);
  });

  return { transfer: transferRow, items: itemRows };
}
