
import { DriverPresence, DriverStatus, Colaborador } from './types';
import { listDriverPresence, saveDriverPresence } from './repositories/delivery.repo';

/**
 * Timeout in ms to consider a driver OFFLINE if no heartbeat received.
 * Default: 45 seconds.
 */
const OFFLINE_TIMEOUT_MS = 45000;

export async function updateDriverHeartbeat(
  driver: Colaborador,
  lat?: number,
  lng?: number,
  status: DriverStatus = 'DISPONIVEL'
) {
  const now = Date.now();
  
  const presence: DriverPresence = {
    driverId: driver.id,
    driverName: driver.nome,
    status: status,
    lastSeenAt: now,
    lat,
    lng,
    // Em um app real, capturaria deviceId
  };

  await saveDriverPresence(presence);
  return presence;
}

export async function getAvailableDrivers(): Promise<DriverPresence[]> {
  const all = await listDriverPresence();
  const now = Date.now();

  return all.filter(p => {
    const isRecent = (now - p.lastSeenAt) < OFFLINE_TIMEOUT_MS;
    // Driver is available if status says so AND he has been seen recentemente
    return isRecent && p.status === 'DISPONIVEL';
  });
}

export async function getAllDriversStatus(): Promise<DriverPresence[]> {
  const all = await listDriverPresence();
  const now = Date.now();

  // Map to check if they are actually offline despite what status says
  return all.map(p => {
    const isTimeout = (now - p.lastSeenAt) > OFFLINE_TIMEOUT_MS;
    if (isTimeout && p.status !== 'OFFLINE') {
      return { ...p, status: 'OFFLINE' };
    }
    return p;
  });
}
