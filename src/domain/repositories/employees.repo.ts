import { db, generateId } from '../db';
import { Colaborador } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDepositId } from '../../src/domain/utils/dataSanitizer';

export async function listEmployees(): Promise<Colaborador[]> {
  const employees = await db.employees.toArray();
  // 🔧 NORMALIZAR depositoId para todos os colaboradores
  return employees.map(normalizeDepositId); // ✅ Usa função global
}

export async function getEmployee(id: string): Promise<Colaborador | undefined> {
  const employee = await db.employees.get(id);
  if (!employee) return undefined;
  
  // 🔧 NORMALIZAR depositoId
  return normalizeDepositId(employee); // ✅ Usa função global
}

export async function upsertEmployee(employee: Colaborador): Promise<Colaborador> {
  // 🔧 NORMALIZAR depositoId usando função global
  const entity = normalizeDepositId(employee.id 
    ? employee 
    : { ...employee, id: generateId() });
  
  // ⚠️ VALIDAÇÃO CRÍTICA: Verificar depositoId para cargos locais
  const isGlobalRole = entity.cargo === 'GERENTE' || entity.cargo === 'ENTREGADOR';
  if (!isGlobalRole && !entity.depositoId) {
    console.error('❌ ERRO: Tentativa de salvar colaborador local sem depositoId!', entity);
    throw new Error(`Cargo ${entity.cargo} requer depositoId! Usuário: ${entity.nome}`);
  }
  
  console.log('💾 Repository salvando:', {
    id: entity.id,
    nome: entity.nome,
    cargo: entity.cargo,
    depositoId: entity.depositoId
  });
  
  await db.transaction('rw', db.employees, db.outbox_events, async () => {
    await db.employees.put(entity);
    await enqueueOutboxEvent({
      entity: 'employees',
      action: 'UPSERT',
      entity_id: entity.id,
      payload_json: entity,
    });
  });
  
  console.log('✅ Repository salvou com sucesso!');
  return entity;
}

export async function deleteEmployee(id: string) {
  await db.transaction('rw', db.employees, db.outbox_events, async () => {
    await db.employees.delete(id);
    await enqueueOutboxEvent({
      entity: 'employees',
      action: 'DELETE',
      entity_id: id,
    });
  });
}
