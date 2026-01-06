/**
 * Script para verificar se os depósitos estão no Supabase
 * e forçar sincronização se necessário
 */

// Dexie precisa de IndexedDB; em Node usamos um polyfill
import 'fake-indexeddb/auto';
import { db } from '../src/domain/db';
import { supabase } from '../src/domain/sync/supabaseClient';

async function checkAndSyncDeposits() {
  await db.open();

  console.log('🔍 Buscando depósitos no Dexie...');
  const localDeposits = await db.deposits.toArray();
  console.log(`📦 Encontrados ${localDeposits.length} depósitos localmente`);

  console.log('\n🌐 Verificando no Supabase...');
  const { data: remoteDeposits, error } = await supabase
    .from('deposits')
    .select('*');

  if (error) {
    console.error('❌ Erro ao buscar depósitos no Supabase:', error);
    return;
  }

  console.log(`☁️  Encontrados ${remoteDeposits?.length || 0} depósitos no Supabase`);

  // Encontrar depósitos que existem localmente mas não no Supabase
  const remoteIds = new Set((remoteDeposits || []).map((d: any) => d.id));
  const missingDeposits = localDeposits.filter(d => !remoteIds.has(d.id));

  if (missingDeposits.length === 0) {
    console.log('\n✅ Todos os depósitos estão sincronizados!');
    return;
  }

  console.log(`\n⚠️  ${missingDeposits.length} depósito(s) faltando no Supabase:`);
  missingDeposits.forEach((d: any) => {
    console.log(`  - ${d.nome || d.name} (${d.id})`);
  });

  console.log('\n🔄 Enfileirando depósitos para sincronização...');
  
  for (const deposit of missingDeposits) {
    await db.outbox_events.add({
      id: crypto.randomUUID(),
      entity: 'deposits',
      action: 'UPSERT',
      entity_id: deposit.id,
      payload_json: deposit,
      status: 'PENDING',
      attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`  ✅ Enfileirado: ${deposit.nome || deposit.name}`);
  }

  console.log('\n💡 Execute a sincronização para enviar ao Supabase');
}

checkAndSyncDeposits()
  .then(() => {
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Erro:', err);
    process.exit(1);
  });
