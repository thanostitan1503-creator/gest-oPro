/**
 * Script para corrigir ordem de sincronização
 *
 * Problema: stock_movements foram enviados ANTES dos deposits
 * Solução: Marca eventos com erro como PENDING novamente para retentar
 */

// Dexie precisa de IndexedDB; em Node usamos um polyfill
import 'fake-indexeddb/auto';
import { db } from '../src/domain/db';

async function fixSyncOrder() {
  await db.open();

  console.log('🔍 Verificando eventos com erro...');

  const failedEvents = await db.outbox_events
    .where('status')
    .equals('FAILED')
    .toArray();

  console.log(`❌ Encontrados ${failedEvents.length} eventos com erro`);

  // Separar por entidade
  const byEntity: Record<string, any[]> = {};
  failedEvents.forEach(ev => {
    if (!byEntity[ev.entity]) byEntity[ev.entity] = [];
    byEntity[ev.entity].push(ev);
  });

  console.log('\n📊 Eventos por entidade:');
  Object.entries(byEntity).forEach(([entity, events]) => {
    console.log(`  - ${entity}: ${events.length}`);
  });

  // Marcar todos como PENDING para retentar (a nova ordem de priorização vai resolver)
  console.log('\n🔄 Marcando todos os eventos como PENDING...');
  
  const idsToUpdate = failedEvents.map(ev => ev.id);
  
  await db.outbox_events
    .where('id')
    .anyOf(idsToUpdate)
    .modify({ status: 'PENDING', attempts: 0, last_error: null });

  console.log(`✅ ${idsToUpdate.length} eventos marcados como PENDING`);
  console.log('\n💡 Execute o comando de sincronização para reprocessar');
  console.log('   A nova ordem de priorização vai sincronizar deposits primeiro!');
}

fixSyncOrder()
  .then(() => {
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Erro:', err);
    process.exit(1);
  });
