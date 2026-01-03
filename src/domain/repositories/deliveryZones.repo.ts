import { db, generateId } from '../db';
import { DeliverySector, DeliveryZone } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDepositId } from '../../src/domain/utils/dataSanitizer';

export async function listDeliveryZones() {
  const zones = await db.delivery_zones.toArray();
  return zones.map(normalizeDepositId); // ✅ Normalizar na leitura
}

export async function getDeliveryZone(id: string) {
  const zone = await db.delivery_zones.get(id);
  return zone ? normalizeDepositId(zone) : undefined; // ✅ Normalizar na leitura
}

export async function upsertDeliveryZone(zone: DeliveryZone) {
  const entity: DeliveryZone = zone.id ? zone : { ...zone, id: generateId() };
  await db.transaction('rw', db.delivery_zones, db.outbox_events, async () => {
    await db.delivery_zones.put(entity);
    await enqueueOutboxEvent({
      entity: 'delivery_zones',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });
  return entity;
}

export async function deleteDeliveryZone(id: string) {
  await db.transaction('rw', db.delivery_zones, db.delivery_zones, db.outbox_events, async () => {
    const sectors = await db.delivery_zones.where('zone_id').equals(id).toArray();
    await db.delivery_zones.where('zone_id').equals(id).delete();
    for (const sector of sectors) {
      await enqueueOutboxEvent({
        entity: 'delivery_zones',
        action: 'DELETE',
        entity_id: sector.id,
      });
    }

    await db.delivery_zones.delete(id);
    await enqueueOutboxEvent({
      entity: 'delivery_zones',
      action: 'DELETE',
      entity_id: id,
    });
  });
}

export async function listDeliverySectors(zoneId?: string | null) {
  if (!zoneId) return db.delivery_zones.toArray();
  return db.delivery_zones.where('zone_id').equals(zoneId).toArray();
}

export async function upsertDeliverySector(sector: DeliverySector) {
  const entity: DeliverySector = sector.id ? sector : { ...sector, id: generateId() };
  await db.transaction('rw', db.delivery_zones, db.outbox_events, async () => {
    await db.delivery_zones.put(entity);
    await enqueueOutboxEvent({
      entity: 'delivery_zones',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });
  return entity;
}

export async function moveDeliverySector(sectorId: string, targetZoneId: string) {
  const sector = await db.delivery_zones.get(sectorId);
  if (!sector) return undefined;
  const updated: DeliverySector = { ...sector, zone_id: targetZoneId };
  return upsertDeliverySector(updated);
}

export async function deleteDeliverySector(id: string) {
  await db.transaction('rw', db.delivery_zones, db.outbox_events, async () => {
    await db.delivery_zones.delete(id);
    await enqueueOutboxEvent({
      entity: 'delivery_zones',
      action: 'DELETE',
      entity_id: id,
    });
  });
}
