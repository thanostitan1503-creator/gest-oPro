import { db, generateId } from '../db';
import type { Colaborador } from '../types';

/**
 * Lists all employees in the system. Simply returns the contents of the
 * employees table.
 */
export async function listEmployees(): Promise<Colaborador[]> {
  const records = await db.employees.toArray();
  return records as any;
}

/**
 * Inserts or updates an employee. Ensures the depositoId property is either a
 * string or null (never undefined) and enqueues an outbox event for
 * synchronisation. For updates the record is replaced entirely.
 */
export async function upsertEmployee(employee: Colaborador): Promise<Colaborador> {
  const normalized: any = {
    ...employee,
    // Normalise undefined to null for depositoId
    depositoId: employee.depositoId ?? null,
  };
  await db.employees.put(normalized);
  await db.outbox_events.put({
    id: generateId(),
    entity: 'employees',
    entity_id: normalized.id,
    action: 'upsert',
    created_at: Date.now(),
  });
  return normalized as Colaborador;
}

/**
 * Soft deletes an employee by marking them as inactive. Does nothing if the
 * employee does not exist. An outbox event is generated for the operation.
 */
export async function deleteEmployee(id: string): Promise<void> {
  const existing = await db.employees.get(id);
  if (existing) {
    (existing as any).ativo = false;
    await db.employees.put(existing);
    await db.outbox_events.put({
      id: generateId(),
      entity: 'employees',
      entity_id: id,
      action: 'delete',
      created_at: Date.now(),
    });
  }
}
