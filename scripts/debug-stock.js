// Script de diagnóstico para executar no Console do navegador
// Abra o DevTools (F12) e cole este código no Console

(async function debugStock() {
  console.log('🔍 Diagnóstico de Estoque - IndexedDB\n');
  
  // Abrir o banco Dexie
  const dbName = 'gestao_gas_db';
  const request = indexedDB.open(dbName);
  
  request.onsuccess = async (event) => {
    const db = event.target.result;
    
    // 1. Produtos
    console.log('📦 PRODUTOS:');
    const txProducts = db.transaction(['products'], 'readonly');
    const storeProducts = txProducts.objectStore('products');
    const products = await new Promise((resolve) => {
      const req = storeProducts.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    console.table(products.map(p => ({
      id: p.id,
      nome: p.nome,
      deposit_id: p.deposit_id || p.depositId || p.depositoId,
      current_stock: p.current_stock ?? p.currentStock ?? 'undefined',
      track_stock: p.track_stock ?? p.trackStock ?? true
    })));
    
    // 2. Movimentos de Estoque
    console.log('\n📋 STOCK_MOVEMENTS:');
    const txMovements = db.transaction(['stock_movements'], 'readonly');
    const storeMovements = txMovements.objectStore('stock_movements');
    const movements = await new Promise((resolve) => {
      const req = storeMovements.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    console.log(`Total de movimentos: ${movements.length}`);
    console.table(movements.slice(-10).map(m => ({
      id: m.id?.slice(0, 8),
      produto: m.produtoNome || m.produto_nome || m.product_id?.slice(0, 8),
      tipo: m.tipo,
      quantidade: m.quantidade,
      depositoId: m.depositoId || m.deposito_id || m.deposit_id,
      origem: m.origem,
      dataHora: m.dataHora || m.created_at
    })));
    
    // 3. Stock Balance
    console.log('\n📊 STOCK_BALANCE:');
    const txBalance = db.transaction(['stock_balance'], 'readonly');
    const storeBalance = txBalance.objectStore('stock_balance');
    const balances = await new Promise((resolve) => {
      const req = storeBalance.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    console.log(`Total de registros: ${balances.length}`);
    console.table(balances.map(b => ({
      product_id: b.product_id?.slice(0, 8),
      deposit_id: b.deposit_id,
      quantidade_atual: b.quantidade_atual
    })));
    
    // 4. Outbox Events
    console.log('\n📤 OUTBOX_EVENTS (últimos 5):');
    const txOutbox = db.transaction(['outbox_events'], 'readonly');
    const storeOutbox = txOutbox.objectStore('outbox_events');
    const outboxEvents = await new Promise((resolve) => {
      const req = storeOutbox.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    console.table(outboxEvents.slice(-5).map(e => ({
      entity: e.entity,
      action: e.action,
      status: e.status,
      entity_id: e.entity_id?.slice(0, 8),
      tries: e.tries
    })));
    
    console.log('\n✅ Diagnóstico concluído!');
    console.log('📝 Verificações:');
    console.log('1. Produtos devem ter deposit_id definido');
    console.log('2. stock_movements deve ter registros com produtoId e depositoId (camelCase)');
    console.log('3. stock_balance deve ter registros com quantidade_atual > 0');
    console.log('4. Se stock_balance está vazio, os movimentos não estão sendo aplicados');
    
    db.close();
  };
  
  request.onerror = (event) => {
    console.error('❌ Erro ao abrir banco:', event);
  };
})();
