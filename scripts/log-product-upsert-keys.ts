import fs from 'node:fs';
import path from 'node:path';

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Remove aspas simples/duplas, se houver
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnvLocal();

// Importa após carregar env (para o supabaseClient ler process.env)
const { applyProductUpsert } = await import('../domain/sync/supabaseAppliers');

const debugId = globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `${Math.random().toString(16).slice(2)}-${Date.now()}`;

await applyProductUpsert({
  id: debugId,
  codigo: `debug_${String(debugId).replace(/-/g, '').slice(-8)}`,
  nome: 'debug product (keys log)',
  tipo: 'OUTROS',
  descricao: null,
  unidade: 'un',
  product_group: 'debug',
  imagem_url: null,
  deposit_id: null,
  preco_padrao: 2,
  preco_custo: 1,
  preco_venda: 2,
  marcacao: 100,
  tracks_empties: false,
  ativo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

console.log('Done (product id):', debugId);
