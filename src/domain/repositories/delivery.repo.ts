import { db, generateId } from '../db';
import { DeliveryJob, DriverPresence } from '../types';

export async function listDeliveryJobs(status?: DeliveryJob['status']) {
  if (!status) return db.delivery_jobs.toArray();
  return db.delivery_jobs.where('status').equals(status).toArray();
}

export async function getDeliveryJob(id: string) {
  return db.delivery_jobs.get(id);
}

export async function listDeliveryJobsByDriver(driverId: string) {
  return db.delivery_jobs.where('assignedDriverId').equals(driverId).toArray();
}

export async function upsertDeliveryJob(job: DeliveryJob) {
  const entity: DeliveryJob = job.id ? job : { ...job, id: generateId() };
  await db.delivery_jobs.put(entity);
  return entity;
}

export async function deleteDeliveryJob(id: string) {
  await db.delivery_jobs.delete(id);
}

export async function saveDriverPresence(presence: DriverPresence) {
  const row: DriverPresence = presence.driverId ? presence : { ...presence, driverId: generateId() };
  await db.driver_presence.put(row);
  return row;
}

export async function listDriverPresence() {
  return db.driver_presence.orderBy('lastSeenAt').reverse().toArray();
}

export async function getDriverPresence(driverId: string) {
  return db.driver_presence.get(driverId);
}
