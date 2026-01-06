import { db, generateId, OutboxAction, OutboxEntity, OutboxEventRow, OutboxStatus } from '../db';

type NormalizedError = {
  message: string;
  code?: string;
};

function normalizeError(error: unknown): NormalizedError {
  if (error && typeof error === 'object') {
    const anyErr = error as any;
    const message = String(anyErr?.message ?? anyErr?.error_description ?? anyErr?.details ?? error);
    const code = anyErr?.code ? String(anyErr.code) : undefined;
    return { message, code };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * Erros típicos quando o schema do Supabase ainda não foi migrado
 * (ex.: PGRST204, coluna inexistente, relação inexistente).
 *
 * Importante: esses erros NÃO devem consumir todas as tentativas rapidamente,
 * pois é comum o usuário aplicar a migração depois.
 */
function looksLikeSchemaError(err: NormalizedError): boolean {
  const code = String(err.code ?? '').toUpperCase();
  const msg = String(err.message ?? '').toLowerCase();

  if (code === 'PGRST204') return true; // schema cache / coluna não encontrada
  if (code === '42703') return true; // undefined_column
  if (code === '42P01') return true; // undefined_table

  if (msg.includes('schema cache') && msg.includes('could not find')) return true;
  if (msg.includes('could not find') && msg.includes('column')) return true;
  if (msg.includes('column') && msg.includes('does not exist')) return true;
  if (msg.includes('relation') && msg.includes('does not exist')) return true;
  if (msg.includes('undefined column')) return true;

  return false;
}

function computeFailedRetryBackoffMs(attempts: number, lastError?: string): number {
  const info = { message: lastError ?? '' };

  // Para erro de schema: retenta para sempre, mas com um ritmo mais humano
  if (looksLikeSchemaError(info)) return 15_000;

  // Para outros erros: exponencial leve, com teto
  // 1: 2s, 2: 4s, 3: 8s... teto 60s
  const base = Math.pow(2, Math.max(0, attempts)) * 1000;
  return Math.min(60_000, Math.max(2_000, base));
}

export type EnqueueOutboxParams = {
  entity: OutboxEntity;
  action: OutboxAction;
  entity_id: string;
  payload_json?: any;
  status?: OutboxStatus;
};

export async function enqueueOutboxEvent(params: EnqueueOutboxParams) {
  const now = Date.now();
  const row: OutboxEventRow = {
    id: generateId(),
    entity: params.entity,
    action: params.action,
    entity_id: params.entity_id,
    payload_json: params.payload_json,
    created_at: now,
    updated_at: now,
    status: params.status ?? 'PENDING',
    attempts: 0,
  };
  await db.outbox_events.put(row);
  return row;
}

export async function listSyncableOutboxEvents(limit = 50) {
  // Pega PENDING primeiro e depois FAILED (para retry), limitando tentativas.
  const pending = await db.outbox_events
    .where('status')
    .equals('PENDING')
    .sortBy('created_at');

  if (pending.length >= limit) return pending.slice(0, limit);

  const remaining = limit - pending.length;
  const now = Date.now();

  const failed = await db.outbox_events
    .where('status')
    .equals('FAILED')
    .filter((e) => {
      // ⚠️ Não deixar eventos morrerem por erro de schema.
      // Para outros erros, limitamos tentativas para evitar loop eterno.
      const isSchema = looksLikeSchemaError({ message: e.last_error ?? '' });
      if (!isSchema && (e.attempts ?? 0) >= 10) return false;

      // Backoff para reduzir cascata de logs/erros
      const backoff = computeFailedRetryBackoffMs(e.attempts ?? 0, e.last_error);
      const updatedAt = e.updated_at ?? e.created_at ?? 0;
      return now - updatedAt >= backoff;
    })
    .sortBy('created_at');

  return pending.concat(failed.slice(0, remaining));
}

export async function markOutboxSent(id: string) {
  const now = Date.now();
  await db.outbox_events.update(id, {
    status: 'SENT',
    updated_at: now,
    synced_at: now,
    last_error: undefined,
  });
}

export async function markOutboxFailed(id: string, error: unknown) {
  const now = Date.now();
  const err = normalizeError(error);
  const msg = err.message;
  const isSchema = looksLikeSchemaError(err);

  await db.transaction('rw', db.outbox_events, async () => {
    const current = await db.outbox_events.get(id);
    if (!current) return;
    await db.outbox_events.update(id, {
      status: 'FAILED',
      updated_at: now,
      // ✅ Erro de schema não “gasta” tentativas (o usuário pode migrar depois)
      attempts: isSchema ? (current.attempts ?? 0) : (current.attempts ?? 0) + 1,
      last_error: msg,
    });
  });
}
