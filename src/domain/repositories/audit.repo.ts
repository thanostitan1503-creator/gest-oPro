import { db, generateId, AuditLogRow } from '../db';

export async function recordAudit(entry: Omit<AuditLogRow, 'id' | 'criado_em'> & { criado_em?: number }) {
  const row: AuditLogRow = {
    ...entry,
    id: generateId(),
    criado_em: entry.criado_em ?? Date.now(),
  };
  await db.audit_logs.put(row);
  return row;
}

export async function listAuditLogs(limit = 200) {
  return db.audit_logs.orderBy('criado_em').reverse().limit(limit).toArray();
}
