import { db } from '../db';
import { ZonePricing } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDepositId } from '../../src/domain/utils/dataSanitizer';

const buildZonePricingId = (depositId: string, zoneId: string) => `${depositId}:${zoneId}`;

export async function listZonePricingByDeposit(depositId: string) {
  if (!depositId) return [];
  const results = await db.zone_pricing.where('deposit_id').equals(depositId).toArray();
  return results.map(normalizeDepositId); // ✅ Normalizar na leitura
}

export async function getZonePricing(depositId: string, zoneId: string) {
  if (!depositId || !zoneId) return undefined;
  const result = await db.zone_pricing.where('[zone_id+deposit_id]').equals([zoneId, depositId]).first();
  return result ? normalizeDepositId(result) : undefined; // ✅ Normalizar na leitura
}

export async function upsertZonePricing(pricing: ZonePricing) {
  // ✅ Normalizar campos de entrada
  const cleanPricing = normalizeDepositId(pricing);
  
  if (!cleanPricing.depositoId || !cleanPricing.zone_id) {
    throw new Error('zone_pricing requires depositoId and zone_id');
  }

  const id = cleanPricing.id || buildZonePricingId(cleanPricing.depositoId, cleanPricing.zone_id);
  const entity: ZonePricing = {
    ...cleanPricing,
    id,
    price: Number(cleanPricing.price || 0),
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
