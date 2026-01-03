import { db, generateId } from '../db';
import { Produto } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDepositId } from '../../src/domain/utils/dataSanitizer';

function isUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // UUID v1-v5
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type NormalizeResult = {
  product: Produto;
  extraProducts: Produto[];
};

function toCode(nome: string, id: string) {
  const base = String(nome ?? 'PROD')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const suffix = String(id).replace(/-/g, '').slice(-6).toLowerCase();
  return suffix ? `${base}_${suffix}` : base || 'produto';
}

function calcMarcacao(preco_custo: number, preco_venda: number): number | null {
  if (!preco_custo || preco_custo <= 0) return null;
  return ((preco_venda - preco_custo) / preco_custo) * 100;
}

/**
 * Converte/Completa um Produto para o contrato oficial snake_case.
 * Aqui é onde a UI pode passar um subset e o repositório consolida.
 */
function canonicalizeProduct(input: Partial<Produto> & { nome: string; tipo: Produto['tipo'] } & { id?: string }): Produto {
  // 🧹 HIGIENIZAR: Normaliza depositoId no input ANTES de processar
  const cleanInput = normalizeDepositId(input);
  
  const id = cleanInput.id && isUuid(cleanInput.id) ? cleanInput.id : generateId();
  const nowIso = new Date().toISOString();

  const productTypeRaw = (cleanInput as any).type ?? (cleanInput as any).item_type ?? null;
  const trackStockInput =
    typeof (cleanInput as any).track_stock === 'boolean'
      ? (cleanInput as any).track_stock
      : typeof (cleanInput as any).trackStock === 'boolean'
        ? (cleanInput as any).trackStock
        : undefined;
  const deliveryFlag =
    (cleanInput as any).is_delivery_fee === true ||
    (cleanInput as any).isDeliveryFee === true;
  const groupCandidate = String(input.product_group ?? input.codigo ?? '').toLowerCase();
  const nameCandidate = String(input.nome ?? '').trim().toLowerCase();
  const isDeliveryFee =
    deliveryFlag ||
    groupCandidate === 'delivery_fee' ||
    nameCandidate === 'taxa de entrega';
  const isService = productTypeRaw === 'SERVICE' || trackStockInput === false || isDeliveryFee;
  const track_stock = isService ? false : trackStockInput ?? true;
  const productType = isService ? 'SERVICE' : productTypeRaw;
  const tracksEmpties = isService ? false : Boolean(input.tracks_empties ?? (input.tipo === 'GAS_CHEIO'));
  const min_stock =
    isService
      ? null
      : typeof (input as any).min_stock === 'number'
        ? (input as any).min_stock
        : typeof (input as any).minStock === 'number'
          ? (input as any).minStock
          : null;

  const codigoBase = String(input.codigo ?? '').trim() || toCode(input.nome, id);
  const codigo = isDeliveryFee ? 'delivery_fee' : codigoBase;
  const product_group = isDeliveryFee ? 'delivery_fee' : input.product_group ?? codigo;
  const preco_custo_raw = Number(input.preco_custo ?? 0) || 0;
  const preco_venda_raw = Number(input.preco_venda ?? input.preco_padrao ?? 0) || 0;
  const preco_padrao_raw = Number(input.preco_padrao ?? preco_venda_raw) || 0;
  const preco_custo = isDeliveryFee ? 0 : preco_custo_raw;
  const preco_venda = isDeliveryFee ? 0 : preco_venda_raw;
  const preco_padrao = isDeliveryFee ? 0 : preco_padrao_raw;
  const movementTypeRaw = String(
    (input as any).movement_type ?? (input as any).movementType ?? ''
  ).toUpperCase();
  const movementType =
    movementTypeRaw === 'SIMPLE' || movementTypeRaw === 'EXCHANGE' || movementTypeRaw === 'FULL'
      ? (movementTypeRaw as any)
      : null;
  const movement_type = movementType ?? (isService ? 'SIMPLE' : tracksEmpties ? 'EXCHANGE' : 'SIMPLE');
  const returnRaw =
    (input as any).return_product_id ?? (input as any).returnProductId ?? null;
  const return_product_id =
    movement_type === 'EXCHANGE' && returnRaw ? String(returnRaw) : null;

  return {
    id,
    codigo,
    nome: isDeliveryFee ? 'Taxa de entrega' : cleanInput.nome,
    tipo: isDeliveryFee ? 'OUTROS' : cleanInput.tipo,
    descricao: cleanInput.descricao ?? null,
    unidade: cleanInput.unidade ?? (isService ? 'serv' : 'un'),
    product_group: product_group ?? null,
    imagem_url: cleanInput.imagem_url ?? null,
    type: productType,
    is_delivery_fee: isDeliveryFee,
    movement_type,
    return_product_id,
    depositoId: isService ? null : cleanInput.depositoId && isUuid(cleanInput.depositoId) ? cleanInput.depositoId : null, // ✅ Campo normalizado
    current_stock:
      isService
        ? null
        : typeof (input as any).current_stock === 'number'
          ? (input as any).current_stock
          : typeof (input as any).quantidade_atual === 'number'
            ? (input as any).quantidade_atual
            : null,
    min_stock,
    preco_padrao,
    preco_custo,
    preco_venda,
    marcacao: isDeliveryFee ? null : input.marcacao ?? calcMarcacao(preco_custo, preco_venda),
    track_stock,
    tracks_empties: tracksEmpties,
    ativo: Boolean(input.ativo ?? true),
    created_at: input.created_at ?? nowIso,
    updated_at: nowIso,
  };
}

/**
 * Normaliza produto sem criar ou vincular casco automaticamente.
 * A criação/vinculação de vasilhame é responsabilidade explícita da UI.
 */
async function normalizeProduct(product: Produto): Promise<NormalizeResult> {
  return { product, extraProducts: [] };
}

export async function listProducts(): Promise<Produto[]> {
  // 🧹 HIGIENIZAR: Normaliza depositoId ao listar
  const products = await db.products.toArray();
  return products.map(normalizeDepositId);
}

export async function getProduct(id: string): Promise<Produto | undefined> {
  const product = await db.products.get(id);
  if (!product) return undefined;
  
  // 🧹 HIGIENIZAR: Normaliza depositoId ao buscar
  return normalizeDepositId(product);
}

export async function createProduct(payload: Produto): Promise<Produto> {
  const entity = canonicalizeProduct(payload as any);
  const normalized = await normalizeProduct(entity);

  await db.transaction('rw', db.products, db.outbox_events, db.stock_balance, async () => {
    for (const extra of normalized.extraProducts) {
      await db.products.put(extra);
      await enqueueOutboxEvent({
        entity: 'products',
        action: 'UPSERT',
        entity_id: extra.id,
        payload_json: extra,
      });
    }
    await db.products.put(normalized.product);
    await enqueueOutboxEvent({
      entity: 'products',
      action: 'UPSERT',
      entity_id: normalized.product.id,
      payload_json: normalized.product,
    });
    // Ensure there's an initial stock_balance row for the product in its deposit (quantity 0)
    if (normalized.product.depositoId) {
      const exists = await db.stock_balance
        .where('[deposit_id+product_id]')
        .equals([normalized.product.depositoId, normalized.product.id])
        .first();
      if (!exists) {
        // ✅ Sempre inicia com 0, o movimento de estoque atualiza depois
        await db.stock_balance.put({
          id: generateId(),
          deposit_id: normalized.product.depositoId,
          product_id: normalized.product.id,
          quantidade_atual: 0,
        });
      }
    }
  });

  return normalized.product;
}

export async function updateProduct(id: string, payload: Partial<Produto>): Promise<Produto> {
  const existing = await db.products.get(id);
  const merged = canonicalizeProduct({
    ...(existing ?? ({} as any)),
    ...(payload as any),
    id,
    nome: (payload as any).nome ?? (existing as any)?.nome ?? '',
    tipo: ((payload as any).tipo ?? (existing as any)?.tipo ?? 'OUTROS') as Produto['tipo'],
  });

  const normalized = await normalizeProduct(merged);

  await db.transaction('rw', db.products, db.outbox_events, db.stock_balance, async () => {
    for (const extra of normalized.extraProducts) {
      await db.products.put(extra);
      await enqueueOutboxEvent({
        entity: 'products',
        action: 'UPSERT',
        entity_id: extra.id,
        payload_json: extra,
      });
    }
    await db.products.put(normalized.product);
    await enqueueOutboxEvent({
      entity: 'products',
      action: 'UPSERT',
      entity_id: normalized.product.id,
      payload_json: normalized.product,
    });
    // Ensure stock_balance exists for updated product if deposit assigned
    if (normalized.product.depositoId) { // ✅ Usa depositoId normalizado
      const exists = await db.stock_balance
        .where('[deposit_id+product_id]')
        .equals([normalized.product.depositoId, normalized.product.id])
        .first();
      if (!exists) {
        const initialQty = Number(normalized.product.current_stock ?? 0) || 0;
        await db.stock_balance.put({
          id: generateId(),
          deposit_id: normalized.product.depositoId, // ✅ Usa depositoId normalizado
          product_id: normalized.product.id,
          quantidade_atual: initialQty,
        });
      }
    }
  });

  return normalized.product;
}

export async function upsertProduct(product: Produto): Promise<Produto> {
  const entity = canonicalizeProduct(product as any);
  const normalized = await normalizeProduct(entity);

  await db.transaction('rw', db.products, db.outbox_events, db.stock_balance, async () => {
    for (const extra of normalized.extraProducts) {
      await db.products.put(extra);
      await enqueueOutboxEvent({
        entity: 'products',
        action: 'UPSERT',
        entity_id: extra.id,
        payload_json: extra,
      });
    }
    await db.products.put(normalized.product);
    await enqueueOutboxEvent({
      entity: 'products',
      action: 'UPSERT',
      entity_id: normalized.product.id,
      payload_json: normalized.product,
    });
    // Ensure stock_balance exists for upserted product if deposit assigned
    if (normalized.product.depositoId) { // ✅ Usa depositoId normalizado
      const exists = await db.stock_balance
        .where('[deposit_id+product_id]')
        .equals([normalized.product.depositoId, normalized.product.id])
        .first();
      if (!exists) {
        const initialQty = Number(normalized.product.current_stock ?? 0) || 0;
        await db.stock_balance.put({
          id: generateId(),
          deposit_id: normalized.product.depositoId, // ✅ Usa depositoId normalizado
          product_id: normalized.product.id,
          quantidade_atual: initialQty,
        });
      }
    }
  });

  return normalized.product;
}

export async function deleteProduct(id: string) {
  await db.transaction('rw', [
    db.products, 
    db.stock_balance, 
    db.stock_movements,
    db.zone_pricing,
    db.product_exchange_rules,
    db.outbox_events
  ], async () => {
    // 1. Deletar produto
    await db.products.delete(id);
    
    // 2. Limpar stock_balance órfãos (busca manual para evitar erro de índice)
    const allBalances = await db.stock_balance.toArray();
    const orphanedBalances = allBalances.filter(b => b.product_id === id);
    for (const balance of orphanedBalances) {
      await db.stock_balance.delete(balance.id);
    }
    
    // 3. Limpar stock_movements órfãos
    const allMovements = await db.stock_movements.toArray();
    const orphanedMovements = allMovements.filter(m => m.produtoId === id);
    for (const movement of orphanedMovements) {
      await db.stock_movements.delete(movement.id);
    }
    
    // 4. Limpar zone_pricing órfãos
    const allPricing = await db.zone_pricing.toArray();
    const orphanedPricing = allPricing.filter(p => p.productId === id);
    for (const pricing of orphanedPricing) {
      await db.zone_pricing.delete(pricing.id);
    }
    
    // 5. Limpar product_exchange_rules órfãos
    const allRules = await db.product_exchange_rules.toArray();
    const orphanedRules = allRules.filter(r => r.productId === id || r.returnProductId === id);
    for (const rule of orphanedRules) {
      await db.product_exchange_rules.delete(rule.id);
    }
    
    // 6. Enfileirar sync
    await enqueueOutboxEvent({
      entity: 'products',
      action: 'DELETE',
      entity_id: id,
    });
  });
}
