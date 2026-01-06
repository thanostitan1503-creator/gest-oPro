
import { DeliveryJob, OrdemServico, DeliveryStatus, Colaborador } from './types';
import { getDeliveryJob, listDeliveryJobs, upsertDeliveryJob } from './repositories/delivery.repo';
import { updateServiceOrderStatus } from './repositories/serviceOrders.repo';

// Helper UUID
const uuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

/**
 * Cria um DeliveryJob a partir de uma Ordem de Serviço DELIVERY
 * Status inicial: PENDENTE_ENTREGA
 */
export async function createDeliveryJobFromOS(os: OrdemServico): Promise<DeliveryJob> {
  const itemsStr = os.itens.map(i => `${i.quantidade}x ${i.produtoId}`).join(', ');
  
  const job: DeliveryJob = {
    id: os.id || uuid(),
    osId: os.id,
    depositoId: os.depositoId,
    status: 'PENDENTE_ENTREGA', // ✅ Status simplificado
    customerName: os.clienteNome,
    customerPhone: os.clienteTelefone,
    address: {
      full: os.enderecoEntrega || 'Endereço não informado',
      lat: os.latitude,
      lng: os.longitude
    },
    itemsSummary: itemsStr,
    totalValue: os.total,
    paymentMethod: os.pagamentos[0]?.formaPagamentoId || 'Desconhecido',
    observation: os.observacoes
  };

  await upsertDeliveryJob(job);
  return job;
}

/**
 * Inicia a rota de entrega
 * PENDENTE_ENTREGA → EM_ROTA
 */
export async function startRoute(jobId: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'PENDENTE_ENTREGA') return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'EM_ROTA',
    startedAt: Date.now()
  };

  await upsertDeliveryJob(updated);
  await updateServiceOrderStatus(job.osId, 'EM_ANDAMENTO', 'Saiu para entrega');
  
  return updated;
}

/**
 * Completa a entrega com sucesso
 * EM_ROTA → CONCLUIDA
 */
export async function completeJob(jobId: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'EM_ROTA') return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'CONCLUIDA',
    completedAt: Date.now()
  };

  await upsertDeliveryJob(updated);
  await updateServiceOrderStatus(job.osId, 'CONCLUIDA', 'Entrega finalizada');

  return updated;
}

/**
 * Marca entrega como devolvida (falhou)
 * EM_ROTA → DEVOLVIDA
 */
export async function returnJob(jobId: string, reason: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job || job.status !== 'EM_ROTA') return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'DEVOLVIDA',
    refusalReason: reason,
    completedAt: Date.now()
  };

  await upsertDeliveryJob(updated);
  // O.S. volta para PENDENTE para poder ser reenviada
  await updateServiceOrderStatus(job.osId, 'PENDENTE', `Entrega devolvida: ${reason}`);

  return updated;
}

/**
 * Cancela a entrega
 * Qualquer status → CANCELADA
 */
export async function cancelJob(jobId: string, reason: string): Promise<DeliveryJob | null> {
  const job = await getDeliveryJob(jobId);
  
  if (!job) return null;

  const updated: DeliveryJob = {
    ...job,
    status: 'CANCELADA',
    refusalReason: reason
  };

  await upsertDeliveryJob(updated);
  await updateServiceOrderStatus(job.osId, 'CANCELADA', `Cancelado: ${reason}`);
  return updated;
}

/**
 * Funções legadas mantidas para compatibilidade - redirecionam para novo fluxo
 * @deprecated Use startRoute, completeJob, returnJob, cancelJob
 */
export async function assignJobToDriver(jobId: string, driverId: string): Promise<DeliveryJob | null> {
  // No novo fluxo simplificado, não há atribuição por entregador
  // O operador controla tudo manualmente pelo painel
  console.warn('assignJobToDriver está deprecated. Use startRoute para iniciar entrega.');
  return startRoute(jobId);
}

export async function acceptJob(jobId: string, driver: Colaborador): Promise<DeliveryJob | null> {
  console.warn('acceptJob está deprecated. Use startRoute para iniciar entrega.');
  return startRoute(jobId);
}

export async function refuseJob(jobId: string, driverId: string, reason: string): Promise<DeliveryJob | null> {
  console.warn('refuseJob está deprecated. Use returnJob ou cancelJob.');
  return returnJob(jobId, reason);
}

export async function checkDeliveryTimeouts() {
  // No novo fluxo simplificado, não há timeout de aceite
  // Mantido apenas para compatibilidade
  return;
}
