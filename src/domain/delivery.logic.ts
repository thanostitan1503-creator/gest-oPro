
import { DeliveryJob, OrdemServico, DeliveryStatus, Colaborador } from './types';
import { getDeliveryJob, listDeliveryJobs, upsertDeliveryJob } from './repositories/delivery.repo';
import { updateServiceOrderStatus } from './repositories/serviceOrders.repo';
import { updateDriverHeartbeat } from './driverPresence.logic';

// Helper UUID
const uuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export async function createDeliveryJobFromOS(os: OrdemServico): Promise<DeliveryJob> {
  const itemsStr = os.itens.map(i => `${i.quantidade}x ${i.produtoId}`).join(', ');
  
  const job: DeliveryJob = {
    id: os.id || uuid(),
    osId: os.id,
    depositoId: os.depositoId,
    status: 'AGUARDANDO_DESPACHO',
    customerName: os.clienteNome,
    customerPhone: os.clienteTelefone,
    address: {
      full: os.enderecoEntrega || 'Endereço não informado',
      lat: os.latitude,
      lng: os.longitude
    },
    itemsSummary: itemsStr,
    totalValue: os.total,
    paymentMethod: os.pagamentos[0]?.formaPagamentoId || 'Desconhecido', // Simplificação
    observation: os.observacoes
  };

  await upsertDeliveryJob(job);
  return job;
}

export async function assignJobToDriver(jobId: string, driverId: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job) return null;
  if (job.status !== 'AGUARDANDO_DESPACHO' && job.status !== 'FALHA_DEVOLVIDA') return null; // Can only assign if pending

  const updated: DeliveryJob = {
    ...job,
    status: 'ATRIBUIDA',
    assignedDriverId: driverId,
    assignedAt: Date.now(),
    refusalReason: undefined // Clear previous refusal if any
  };

  await upsertDeliveryJob(updated);
  
  // Update OS Status link
  await updateServiceOrderStatus(job.osId, 'PENDENTE_ENTREGA', `Atribuído ao entregador ${driverId}`);
  
  return updated;
}

export async function acceptJob(jobId: string, driver: Colaborador): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'ATRIBUIDA' || job.assignedDriverId !== driver.id) return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'ACEITA',
    acceptedAt: Date.now()
  };

  await upsertDeliveryJob(updated);
  
  // Update Driver Presence to BUSY (Ocupado)
  await updateDriverHeartbeat(driver, undefined, undefined, 'OCUPADO');

  return updated;
}

export async function refuseJob(jobId: string, driverId: string, reason: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'ATRIBUIDA') return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'AGUARDANDO_DESPACHO', // Return to pool
    assignedDriverId: undefined, // Unassign
    assignedAt: undefined,
    refusedAt: Date.now(),
    refusalReason: `${reason} (por ${driverId})`
  };

  await upsertDeliveryJob(updated);
  return updated;
}

export async function startRoute(jobId: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'ACEITA') return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'EM_ROTA',
    startedAt: Date.now()
  };

  await upsertDeliveryJob(updated);
  await updateServiceOrderStatus(job.osId, 'EM_ANDAMENTO', 'Saiu para entrega');
  
  return updated;
}

export async function completeJob(jobId: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'EM_ROTA') return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'ENTREGUE',
    completedAt: Date.now()
  };

  await upsertDeliveryJob(updated);
  await updateServiceOrderStatus(job.osId, 'CONCLUIDA', 'Entrega finalizada pelo App');

  return updated;
}

export async function cancelJob(jobId: string, reason: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job) return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'CANCELADA',
    refusalReason: reason
  };

  await upsertDeliveryJob(updated);
  await updateServiceOrderStatus(job.osId, 'CANCELADA', `Cancelado via Despacho: ${reason}`);
  return updated;
}

/**
 * Checks for jobs that have been assigned but not accepted within timeout (e.g. 60s).
 * Reverts them to waiting pool.
 */
export async function checkDeliveryTimeouts() {
  const jobs = await listDeliveryJobs();
  const now = Date.now();

  const timedOut = jobs.filter(
    (j) => j.status === 'ATRIBUIDA' && j.assignedAt && now - j.assignedAt > 60000
  );

  for (const job of timedOut) {
    const updated: DeliveryJob = {
      ...job,
      status: 'AGUARDANDO_DESPACHO' as DeliveryStatus,
      assignedDriverId: undefined,
      assignedAt: undefined,
      refusalReason: 'Timeout: Motorista não aceitou a tempo'
    };
    await upsertDeliveryJob(updated);
  }
}
