import { db } from '../db';
import { ProductPricing } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';

/**
 * Repository para ProductPricing
 * Gerencia preços de produtos por depósito
 */

const buildPricingId = (productId: string, depositId: string) => `${productId}:${depositId}`;

/**
 * Busca preço específico de um produto em um depósito
 */
export async function getPricing(productId: string, depositId: string): Promise<ProductPricing | undefined> {
  if (!productId || !depositId) return undefined;
  
  const result = await db.zone_pricing
    .where('[productId+depositId]')
    .equals([productId, depositId])
    .first();
  
  return result;
}

/**
 * Busca todos os preços de um produto (em todos os depósitos)
 */
export async function getPricingByProduct(productId: string): Promise<ProductPricing[]> {
  if (!productId) return [];
  
  const results = await db.zone_pricing
    .where('productId')
    .equals(productId)
    .toArray();
  
  return results;
}

/**
 * Busca todos os preços de um depósito (todos os produtos)
 */
export async function getPricingByDeposit(depositId: string): Promise<ProductPricing[]> {
  if (!depositId) return [];
  
  const results = await db.zone_pricing
    .where('depositoId')
    .equals(depositId)
    .toArray();
  
  return results;
}

/**
 * Cria ou atualiza um preço
 */
export async function upsertPricing(pricing: Partial<ProductPricing>): Promise<ProductPricing> {
  if (!pricing.productId || !pricing.depositoId) {
    throw new Error('productPricing requires productId and depositId');
  }
  
  if (typeof pricing.price !== 'number' || pricing.price < 0) {
    throw new Error('productPricing requires valid price (>= 0)');
  }

  const id = pricing.id || buildPricingId(pricing.productId, pricing.depositoId);
  const now = new Date().toISOString();
  
  const entity: ProductPricing = {
    id,
    productId: pricing.productId,
    depositoId: pricing.depositoId,
    price: pricing.price,
    created_at: pricing.created_at || now,
    updated_at: now,
  };

  await db.transaction('rw', db.zone_pricing, db.outbox_events, async () => {
    await db.zone_pricing.put(entity);
    await enqueueOutboxEvent({
      entity: 'zone_pricing',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });

  return entity;
}

/**
 * Salva múltiplos preços de uma vez (transação atômica)
 * Usado quando criar produto em vários depósitos simultaneamente
 */
export async function bulkUpsertPricing(pricings: Array<Partial<ProductPricing>>): Promise<ProductPricing[]> {
  if (!pricings || pricings.length === 0) return [];
  
  const now = new Date().toISOString();
  const entities: ProductPricing[] = [];

  for (const pricing of pricings) {
    if (!pricing.productId || !pricing.depositoId) {
      throw new Error('Each productPricing requires productId and depositId');
    }
    
    if (typeof pricing.price !== 'number' || pricing.price < 0) {
      throw new Error('Each productPricing requires valid price (>= 0)');
    }

    const id = pricing.id || buildPricingId(pricing.productId, pricing.depositoId);
    
    entities.push({
      id,
      productId: pricing.productId,
      depositoId: pricing.depositoId,
      price: pricing.price,
      created_at: pricing.created_at || now,
      updated_at: now,
    });
  }

  await db.transaction('rw', db.zone_pricing, db.outbox_events, async () => {
    await db.zone_pricing.bulkPut(entities);
    
    // Enfileirar eventos de sync para cada preço
    for (const entity of entities) {
      await enqueueOutboxEvent({
        entity: 'zone_pricing',
        action: 'UPSERT',
        entity_id: entity.id,
        payload_json: entity,
      });
    }
  });

  return entities;
}

/**
 * Remove um preço específico
 */
export async function deletePricing(id: string): Promise<void> {
  if (!id) return;
  
  const existing = await db.zone_pricing.get(id);
  if (!existing) return;

  await db.transaction('rw', db.zone_pricing, db.outbox_events, async () => {
    await db.zone_pricing.delete(id);
    await enqueueOutboxEvent({
      entity: 'zone_pricing',
      action: 'DELETE',
      entity_id: id,
      payload_json: existing,
    });
  });
}

/**
 * Remove todos os preços de um produto (usado ao deletar produto)
 */
export async function deletePricingByProduct(productId: string): Promise<void> {
  if (!productId) return;
  
  const pricings = await getPricingByProduct(productId);
  
  await db.transaction('rw', db.zone_pricing, db.outbox_events, async () => {
    for (const pricing of pricings) {
      await db.zone_pricing.delete(pricing.id);
      await enqueueOutboxEvent({
        entity: 'zone_pricing',
        action: 'DELETE',
        entity_id: pricing.id,
        payload_json: pricing,
      });
    }
  });
}

/**
 * Remove todos os preços de um depósito (usado ao deletar depósito)
 */
export async function deletePricingByDeposit(depositId: string): Promise<void> {
  if (!depositId) return;
  
  const pricings = await getPricingByDeposit(depositId);
  
  await db.transaction('rw', db.zone_pricing, db.outbox_events, async () => {
    for (const pricing of pricings) {
      await db.zone_pricing.delete(pricing.id);
      await enqueueOutboxEvent({
        entity: 'zone_pricing',
        action: 'DELETE',
        entity_id: pricing.id,
        payload_json: pricing,
      });
    }
  });
}
