/**
 * 🚀 SCRIPT DE CORREÇÃO RÁPIDA
 * 
 * COMO USAR:
 * 1. Abra o aplicativo no navegador
 * 2. Pressione F12 para abrir DevTools
 * 3. Vá na aba "Console"
 * 4. Cole TODO este código e pressione Enter
 * 5. Execute: fixSync()
 */

// Função principal de diagnóstico e correção
async function fixSync() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     🔧 DIAGNÓSTICO E CORREÇÃO DE SINCRONIZAÇÃO        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Verifica se o db está disponível
  if (typeof db === 'undefined') {
    console.error('❌ ERRO: O banco de dados não está disponível.');
    console.error('   Certifique-se de que você está na página do aplicativo.');
    return;
  }

  // 1. DIAGNÓSTICO
  console.log('📊 DIAGNÓSTICO\n');
  
  const allEvents = await db.outbox_events.toArray();
  const byStatus = {
    PENDING: allEvents.filter(e => e.status === 'PENDING'),
    FAILED: allEvents.filter(e => e.status === 'FAILED'),
    SENT: allEvents.filter(e => e.status === 'SENT'),
  };
  
  console.log(`Total de eventos: ${allEvents.length}`);
  console.log(`  ✅ Enviados: ${byStatus.SENT.length}`);
  console.log(`  ⏳ Pendentes: ${byStatus.PENDING.length}`);
  console.log(`  ❌ Falhos: ${byStatus.FAILED.length}`);

  // Agrupa erros por entidade
  if (byStatus.FAILED.length > 0) {
    console.log('\n❌ EVENTOS COM FALHA:\n');
    
    const byEntity = {};
    for (const ev of byStatus.FAILED) {
      if (!byEntity[ev.entity]) byEntity[ev.entity] = [];
      byEntity[ev.entity].push(ev);
    }
    
    for (const [entity, events] of Object.entries(byEntity)) {
      console.log(`  ${entity}: ${events.length} falha(s)`);
      // Mostra primeiro erro como exemplo
      if (events.length > 0) {
        const firstError = events[0].last_error || 'Erro desconhecido';
        console.log(`    → ${firstError.substring(0, 100)}...`);
      }
    }
  }

  // 2. VERIFICAR DADOS LOCAIS
  console.log('\n📦 DADOS LOCAIS:\n');
  
  const deposits = await db.deposits.toArray();
  const products = await db.products.toArray();
  const movements = await db.stock_movements?.toArray() || [];
  
  console.log(`  Depósitos: ${deposits.length}`);
  console.log(`  Produtos: ${products.length}`);
  console.log(`  Movimentos de estoque: ${movements.length}`);

  // 3. DIAGNÓSTICO DE ERROS COMUNS
  console.log('\n🔍 DIAGNÓSTICO DE ERROS COMUNS:\n');

  // Erro de FK
  const fkErrors = byStatus.FAILED.filter(e => 
    e.last_error?.includes('23503') || 
    e.last_error?.includes('not present in table')
  );
  if (fkErrors.length > 0) {
    console.log('  ⚠️ Erros de FK (chave estrangeira): ' + fkErrors.length);
    console.log('     → Produtos/depósitos não sincronizados antes dos movimentos');
  }

  // Erro de coluna
  const colErrors = byStatus.FAILED.filter(e => 
    e.last_error?.includes('PGRST204') || 
    e.last_error?.includes('could not find')
  );
  if (colErrors.length > 0) {
    console.log('  ⚠️ Erros de coluna inexistente: ' + colErrors.length);
    console.log('     → Execute a migração SQL: 2025_01_05_safe_migration.sql');
  }

  // 4. CORREÇÃO AUTOMÁTICA
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🛠️  CORREÇÃO AUTOMÁTICA');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (byStatus.FAILED.length === 0) {
    console.log('✅ Nenhum evento falho para corrigir!');
    return;
  }

  const resposta = confirm('Deseja resetar os eventos falhos e tentar sincronizar novamente?');
  
  if (!resposta) {
    console.log('Operação cancelada pelo usuário.');
    return;
  }

  // Remove eventos falhos de stock_movements (serão recriados)
  const stockMoveFailures = byStatus.FAILED.filter(e => e.entity === 'stock_movements');
  if (stockMoveFailures.length > 0) {
    console.log(`\n🗑️ Removendo ${stockMoveFailures.length} eventos de stock_movements com erro...`);
    for (const ev of stockMoveFailures) {
      await db.outbox_events.delete(ev.id);
    }
  }

  // Reseta outros eventos falhos
  const otherFailures = byStatus.FAILED.filter(e => e.entity !== 'stock_movements');
  if (otherFailures.length > 0) {
    console.log(`\n🔄 Resetando ${otherFailures.length} outros eventos falhos...`);
    for (const ev of otherFailures) {
      await db.outbox_events.update(ev.id, {
        status: 'PENDING',
        retry_count: 0,
        last_error: null,
      });
    }
  }

  // Recria eventos de stock_movements a partir dos dados locais
  if (movements.length > 0) {
    console.log(`\n➕ Recriando ${movements.length} eventos de stock_movements...`);
    const now = Date.now();
    for (let i = 0; i < movements.length; i++) {
      const m = movements[i];
      // Verifica se já existe evento SENT para este movimento
      const existingSent = byStatus.SENT.find(e => 
        e.entity === 'stock_movements' && e.entity_id === m.id
      );
      if (!existingSent) {
        await db.outbox_events.put({
          id: now + 9000000 + i, // ID alto para ficar no final da fila
          entity: 'stock_movements',
          entity_id: m.id,
          action: 'UPSERT',
          payload_json: m,
          status: 'PENDING',
          retry_count: 0,
          created_at: now,
        });
      }
    }
  }

  console.log('\n✅ CORREÇÃO CONCLUÍDA!');
  console.log('   A sincronização será retomada automaticamente.');
  console.log('   Execute fixSync() novamente em 10 segundos para verificar.');
}

// Expõe a função globalmente
window.fixSync = fixSync;

console.log('🔧 Script carregado! Execute: fixSync()');
