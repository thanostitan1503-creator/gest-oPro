import { db, generateId } from '../db';
import { ProductExchangeRule } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';

const buildId = (productId: string, depositoId: string) => `${productId}:${depositoId}`;

export async function getExchangeRule(productId: string, depositoId: string): Promise<ProductExchangeRule | undefined> {
  if (!productId || !depositoId) return undefined;
  return db.product_exchange_rules.where('[productId+depositoId]').equals([productId, depositoId]).first();
}

export async function listExchangeRulesByProduct(productId: string): Promise<ProductExchangeRule[]> {
  if (!productId) return [];
  return db.product_exchange_rules.where('productId').equals(productId).toArray();
}

export async function upsertExchangeRule(rule: Partial<ProductExchangeRule>): Promise<ProductExchangeRule> {
  if (!rule.productId || !rule.depositoId || !rule.returnProductId) {
    throw new Error('product_exchange_rules requer productId, depositoId e returnProductId');
  }

  const now = new Date().toISOString();
  const entity: ProductExchangeRule = {
    id: rule.id || buildId(rule.productId, rule.depositoId),
    productId: rule.productId,
    depositoId: rule.depositoId,
    returnProductId: rule.returnProductId,
    created_at: rule.created_at || now,
    updated_at: now,
  };

  await db.transaction('rw', db.product_exchange_rules, db.outbox_events, async () => {
    await db.product_exchange_rules.put(entity);
    await enqueueOutboxEvent({
      entity: 'product_exchange_rules',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });

  return entity;
}

export async function bulkUpsertExchangeRules(rules: Array<Partial<ProductExchangeRule>>): Promise<ProductExchangeRule[]> {
  if (!rules.length) return [];
  const now = new Date().toISOString();
  const entities: ProductExchangeRule[] = rules.map((rule) => {
    if (!rule.productId || !rule.depositoId || !rule.returnProductId) {
      throw new Error('product_exchange_rules requer productId, depositoId e returnProductId');
    }
    return {
      id: rule.id || buildId(rule.productId, rule.depositoId),
      productId: rule.productId,
      depositoId: rule.depositoId,
      returnProductId: rule.returnProductId,
      created_at: rule.created_at || now,
      updated_at: now,
    };
  });

  await db.transaction('rw', db.product_exchange_rules, db.outbox_events, async () => {
    await db.product_exchange_rules.bulkPut(entities);
    for (const entity of entities) {
      await enqueueOutboxEvent({
        entity: 'product_exchange_rules',
        action: 'UPSERT',
        entity_id: entity.id,
        payload_json: entity,
      });
    }
  });

  return entities;
}

export async function deleteExchangeRulesByProduct(productId: string): Promise<void> {
  if (!productId) return;
  const existing = await listExchangeRulesByProduct(productId);
  if (!existing.length) return;

  await db.transaction('rw', db.product_exchange_rules, db.outbox_events, async () => {
    for (const rule of existing) {
      await db.product_exchange_rules.delete(rule.id);
      await enqueueOutboxEvent({
        entity: 'product_exchange_rules',
        action: 'DELETE',
        entity_id: rule.id,
        payload_json: rule,
      });
    }
  });
}
