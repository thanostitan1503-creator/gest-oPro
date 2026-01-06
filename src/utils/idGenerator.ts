/**
 * 🆔 ID GENERATOR (v3.0 - Online-Only)
 * 
 * Substitui a função generateId() que estava no Dexie.
 * Gera UUIDs v4 compatíveis com o padrão do projeto.
 */

/**
 * Gera um UUID v4 (compatível com PostgreSQL)
 * 
 * @example
 * const id = generateId();
 * // "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Valida se uma string é um UUID válido
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
