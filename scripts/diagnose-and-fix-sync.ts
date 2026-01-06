/**
 * 🔧 DIAGNÓSTICO E CORREÇÃO DE SINCRONIZAÇÃO
 * 
 * Este script:
 * 1. Verifica o estado dos eventos na outbox
 * 2. Identifica eventos falhando com erros de FK
 * 3. Corrige a ordem de sincronização
 * 4. Reprocessa eventos com erro
 * 
 * COMO EXECUTAR:
 * 1. Abra o DevTools do navegador (F12)
 * 2. Vá na aba Console
 * 3. Cole este script e execute
 */

// Importa o banco de dados (ajuste o caminho conforme necessário)
// Se executar no console do navegador, o db já estará disponível globalmente

async function diagnoseSync() {
  console.log('\n========================================');
  console.log('🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO');
  console.log('========================================\n');

  // @ts-ignore - db é global no navegador
  const db = (window as any).db;
  
  if (!db) {
    console.error('❌ Banco de dados não encontrado! Execute este script na página do aplicativo.');
    return;
  }

  // 1. Verificar eventos na outbox
  console.log('📋 1. EVENTOS NA OUTBOX\n');
  
  const allEvents = await db.outbox_events.toArray();
  const pendingEvents = allEvents.filter((e: any) => e.status === 'PENDING');
  const failedEvents = allEvents.filter((e: any) => e.status === 'FAILED');
  const sentEvents = allEvents.filter((e: any) => e.status === 'SENT');

  console.log(`Total de eventos: ${allEvents.length}`);
  console.log(`  ✅ SENT (enviados): ${sentEvents.length}`);
  console.log(`  ⏳ PENDING (aguardando): ${pendingEvents.length}`);
  console.log(`  ❌ FAILED (falhas): ${failedEvents.length}`);

  // 2. Detalhar eventos falhos
  if (failedEvents.length > 0) {
    console.log('\n📋 2. DETALHES DOS EVENTOS FALHOS\n');
    
    const groupedByEntity: Record<string, any[]> = {};
    for (const ev of failedEvents) {
      if (!groupedByEntity[ev.entity]) {
        groupedByEntity[ev.entity] = [];
      }
      groupedByEntity[ev.entity].push(ev);
    }

    for (const [entity, events] of Object.entries(groupedByEntity)) {
      console.log(`\n🔴 ${entity.toUpperCase()} (${events.length} falhas):`);
      for (const ev of events.slice(0, 3)) { // Mostra até 3 exemplos
        console.log(`   ID: ${ev.entity_id}`);
        console.log(`   Erro: ${ev.last_error || 'N/A'}`);
        console.log(`   Tentativas: ${ev.retry_count || 0}`);
        console.log('   ---');
      }
      if (events.length > 3) {
        console.log(`   ... e mais ${events.length - 3} eventos`);
      }
    }
  }

  // 3. Verificar produtos locais
  console.log('\n📋 3. PRODUTOS NO DEXIE (LOCAL)\n');
  
  const localProducts = await db.products.toArray();
  console.log(`Total de produtos locais: ${localProducts.length}`);
  
  if (localProducts.length > 0) {
    console.log('\nExemplos:');
    for (const p of localProducts.slice(0, 3)) {
      console.log(`  - ${p.nome} (ID: ${p.id.substring(0, 8)}...)`);
      console.log(`    Tipo: ${p.tipo || p.type}, MovType: ${p.movement_type || 'N/A'}`);
    }
  }

  // 4. Verificar depósitos locais
  console.log('\n📋 4. DEPÓSITOS NO DEXIE (LOCAL)\n');
  
  const localDeposits = await db.deposits.toArray();
  console.log(`Total de depósitos locais: ${localDeposits.length}`);
  
  for (const d of localDeposits) {
    console.log(`  - ${d.nome || d.name} (ID: ${d.id.substring(0, 8)}...)`);
  }

  // 5. Análise do problema
  console.log('\n========================================');
  console.log('📊 ANÁLISE DO PROBLEMA');
  console.log('========================================\n');

  const productFailures = failedEvents.filter((e: any) => e.entity === 'products');
  const stockFailures = failedEvents.filter((e: any) => e.entity === 'stock_movements');
  const depositFailures = failedEvents.filter((e: any) => e.entity === 'deposits');

  if (depositFailures.length > 0) {
    console.log('🔴 PROBLEMA CRÍTICO: Depósitos falhando!');
    console.log('   → Isso causa erros em TODAS as outras entidades.');
    console.log('   → Verifique se a migração SQL foi executada.');
  }

  if (productFailures.length > 0 && stockFailures.length > 0) {
    console.log('🔴 PROBLEMA IDENTIFICADO: Produtos e Stock Movements falhando!');
    console.log('   → Os produtos não sincronizaram para o Supabase.');
    console.log('   → Os stock_movements tentam referenciar produtos que não existem.');
    console.log('   → SOLUÇÃO: Resetar eventos e forçar ordem correta.');
  }

  // Verificar erros específicos
  const fkErrors = failedEvents.filter((e: any) => 
    e.last_error?.includes('23503') || 
    e.last_error?.includes('not present in table')
  );
  
  const columnErrors = failedEvents.filter((e: any) => 
    e.last_error?.includes('PGRST204') || 
    e.last_error?.includes('could not find') ||
    e.last_error?.includes('column')
  );

  if (fkErrors.length > 0) {
    console.log(`\n⚠️ ${fkErrors.length} erros de FK (chave estrangeira)`);
    console.log('   → Entidades dependentes estão sendo enviadas antes das principais.');
  }

  if (columnErrors.length > 0) {
    console.log(`\n⚠️ ${columnErrors.length} erros de coluna inexistente`);
    console.log('   → A migração SQL pode não ter sido executada!');
    console.log('   → Execute: supabase/migrations/2025_01_05_safe_migration.sql');
  }

  console.log('\n========================================');
  console.log('🛠️ AÇÕES RECOMENDADAS');
  console.log('========================================\n');

  console.log('1️⃣ Execute a migração SQL no Supabase:');
  console.log('   → Arquivo: supabase/migrations/2025_01_05_safe_migration.sql');
  console.log('');
  console.log('2️⃣ Para resetar eventos e tentar novamente:');
  console.log('   → Execute: resetFailedEvents()');
  console.log('');
  console.log('3️⃣ Para forçar sincronização completa:');
  console.log('   → Execute: forceFullSync()');

  // Expor funções no escopo global
  (window as any).resetFailedEvents = resetFailedEvents;
  (window as any).forceFullSync = forceFullSync;
  (window as any).checkSupabaseProducts = checkSupabaseProducts;

  return {
    totalEvents: allEvents.length,
    pending: pendingEvents.length,
    failed: failedEvents.length,
    sent: sentEvents.length,
    localProducts: localProducts.length,
    localDeposits: localDeposits.length,
  };
}

/**
 * Reseta eventos falhos para PENDING, respeitando a ordem de dependências
 */
async function resetFailedEvents() {
  console.log('\n🔄 Resetando eventos falhos...\n');

  // @ts-ignore
  const db = (window as any).db;
  
  const failedEvents = await db.outbox_events
    .where('status')
    .equals('FAILED')
    .toArray();

  if (failedEvents.length === 0) {
    console.log('✅ Nenhum evento falho para resetar.');
    return;
  }

  // Ordem de prioridade (igual ao syncService)
  const priorityOrder = [
    'deposits',
    'employees',
    'clients',
    'payment_methods',
    'delivery_zones',
    'products',
    'delivery_sectors',
    'zone_pricing',
    'product_pricing',
    'service_orders',
    'stock_movements',
    'work_shifts',
    'accounts_receivable',
  ];

  // Agrupa por entidade
  const grouped: Record<string, any[]> = {};
  for (const ev of failedEvents) {
    if (!grouped[ev.entity]) {
      grouped[ev.entity] = [];
    }
    grouped[ev.entity].push(ev);
  }

  // Reseta na ordem correta
  let resetCount = 0;
  for (const entity of priorityOrder) {
    if (grouped[entity]) {
      console.log(`Resetando ${grouped[entity].length} eventos de ${entity}...`);
      
      for (const ev of grouped[entity]) {
        await db.outbox_events.update(ev.id, {
          status: 'PENDING',
          retry_count: 0,
          last_error: null,
        });
        resetCount++;
      }
    }
  }

  // Reseta qualquer outro que não estava na lista
  for (const [entity, events] of Object.entries(grouped)) {
    if (!priorityOrder.includes(entity)) {
      console.log(`Resetando ${events.length} eventos de ${entity}...`);
      for (const ev of events) {
        await db.outbox_events.update(ev.id, {
          status: 'PENDING',
          retry_count: 0,
          last_error: null,
        });
        resetCount++;
      }
    }
  }

  console.log(`\n✅ ${resetCount} eventos resetados!`);
  console.log('A sincronização será retomada automaticamente.');
  console.log('Execute diagnoseSync() novamente em alguns segundos para verificar.');
}

/**
 * Força re-sincronização completa de todas as entidades
 */
async function forceFullSync() {
  console.log('\n🔄 Forçando sincronização completa...\n');

  // @ts-ignore
  const db = (window as any).db;

  // 1. Pegar todas as entidades locais
  const deposits = await db.deposits.toArray();
  const products = await db.products.toArray();
  const clients = await db.clients.toArray();
  const employees = await db.employees.toArray();

  console.log(`Encontrados:`);
  console.log(`  - ${deposits.length} depósitos`);
  console.log(`  - ${products.length} produtos`);
  console.log(`  - ${clients.length} clientes`);
  console.log(`  - ${employees.length} colaboradores`);

  // 2. Limpar eventos antigos com erro
  const failedCount = await db.outbox_events
    .where('status')
    .equals('FAILED')
    .delete();
  
  console.log(`\n🗑️ Removidos ${failedCount} eventos falhos antigos`);

  // 3. Criar novos eventos na ordem correta
  const now = Date.now();
  let eventId = 1;

  // Depósitos primeiro
  for (const d of deposits) {
    await db.outbox_events.put({
      id: now + eventId++,
      entity: 'deposits',
      entity_id: d.id,
      action: 'UPSERT',
      payload_json: d,
      status: 'PENDING',
      retry_count: 0,
      created_at: now,
    });
  }
  console.log(`✅ ${deposits.length} eventos de depósitos criados`);

  // Colaboradores
  for (const e of employees) {
    await db.outbox_events.put({
      id: now + eventId++,
      entity: 'employees',
      entity_id: e.id,
      action: 'UPSERT',
      payload_json: e,
      status: 'PENDING',
      retry_count: 0,
      created_at: now,
    });
  }
  console.log(`✅ ${employees.length} eventos de colaboradores criados`);

  // Clientes
  for (const c of clients) {
    await db.outbox_events.put({
      id: now + eventId++,
      entity: 'clients',
      entity_id: c.id,
      action: 'UPSERT',
      payload_json: c,
      status: 'PENDING',
      retry_count: 0,
      created_at: now,
    });
  }
  console.log(`✅ ${clients.length} eventos de clientes criados`);

  // Produtos
  for (const p of products) {
    await db.outbox_events.put({
      id: now + eventId++,
      entity: 'products',
      entity_id: p.id,
      action: 'UPSERT',
      payload_json: p,
      status: 'PENDING',
      retry_count: 0,
      created_at: now,
    });
  }
  console.log(`✅ ${products.length} eventos de produtos criados`);

  console.log('\n✅ Sincronização forçada iniciada!');
  console.log('Execute diagnoseSync() em alguns segundos para verificar o progresso.');
}

/**
 * Verifica se os produtos existem no Supabase
 */
async function checkSupabaseProducts() {
  console.log('\n🔍 Verificando produtos no Supabase...\n');

  // @ts-ignore
  const supabase = (window as any).supabase;
  
  if (!supabase) {
    console.error('❌ Cliente Supabase não encontrado!');
    return;
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, code, type, is_active')
    .limit(100);

  if (error) {
    console.error('❌ Erro ao consultar Supabase:', error);
    return;
  }

  console.log(`Total de produtos no Supabase: ${data?.length || 0}`);
  
  if (data && data.length > 0) {
    console.log('\nExemplos:');
    for (const p of data.slice(0, 5)) {
      console.log(`  - ${p.name || '(sem nome)'} (ID: ${p.id?.substring(0, 8)}...)`);
      console.log(`    Código: ${p.code || 'N/A'}, Tipo: ${p.type || 'N/A'}`);
    }
  } else {
    console.log('⚠️ Nenhum produto encontrado no Supabase!');
    console.log('   → Os produtos não estão sendo sincronizados.');
    console.log('   → Execute forceFullSync() para tentar novamente.');
  }
}

// Executa diagnóstico automaticamente
diagnoseSync();

export { diagnoseSync, resetFailedEvents, forceFullSync, checkSupabaseProducts };
