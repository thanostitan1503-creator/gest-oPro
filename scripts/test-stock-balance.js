// ========================================
// TESTE RÁPIDO - Stock Balance Verification
// ========================================
// Cole este código no Console do navegador (F12)
// após criar um produto com estoque inicial
// ========================================

(async function quickTest() {
  console.log('🔍 Verificação Rápida de Estoque\n');
  
  try {
    // Importar db do Dexie
    const { db } = await import('/domain/db.js');
    
    // 1. Listar produtos
    const products = await db.products.toArray();
    console.log('📦 Total de produtos:', products.length);
    
    const lastProduct = products[products.length - 1];
    console.log('\n📝 Último produto criado:');
    console.log({
      id: lastProduct.id,
      nome: lastProduct.nome,
      deposit_id: lastProduct.deposit_id,
      current_stock: lastProduct.current_stock
    });
    
    // 2. Verificar movimentos
    const movements = await db.stock_movements
      .where('produtoId')
      .equals(lastProduct.id)
      .toArray();
    console.log('\n📋 Movimentos do produto:', movements.length);
    movements.forEach(m => {
      console.log({
        tipo: m.tipo,
        quantidade: m.quantidade,
        depositoId: m.depositoId,
        produtoId: m.produtoId
      });
    });
    
    // 3. Verificar stock_balance
    if (lastProduct.deposit_id) {
      const balance = await db.stock_balance
        .where('[deposit_id+product_id]')
        .equals([lastProduct.deposit_id, lastProduct.id])
        .first();
      
      console.log('\n📊 Stock Balance:');
      if (balance) {
        console.log({
          deposit_id: balance.deposit_id,
          product_id: balance.product_id,
          quantidade_atual: balance.quantidade_atual
        });
        
        if (balance.quantidade_atual > 0) {
          console.log('✅ SUCESSO! Estoque está registrado corretamente');
        } else {
          console.log('⚠️ PROBLEMA: stock_balance existe mas quantidade é 0');
          console.log('Possível causa: movimento não foi aplicado ou foi aplicado antes do produto');
        }
      } else {
        console.log('❌ ERRO: stock_balance não encontrado para este produto!');
        console.log('Possível causa: produto criado sem deposit_id ou movimento falhou');
      }
    } else {
      console.log('⚠️ Produto não tem deposit_id definido');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.log('\n📌 Executar manualmente:');
    console.log('1. Abrir Application > IndexedDB > gestao_gas_db');
    console.log('2. Verificar tabelas: products, stock_movements, stock_balance');
  }
})();

// ========================================
// TESTE ALTERNATIVO (sem importar módulo)
// ========================================
console.log('\n\n🔧 Teste Alternativo - Acesso Direto ao IndexedDB:\n');

(async function directTest() {
  const request = indexedDB.open('gestao_gas_db');
  
  request.onsuccess = async (event) => {
    const db = event.target.result;
    
    // Ler último produto
    const txProd = db.transaction(['products'], 'readonly');
    const products = await new Promise((resolve) => {
      const req = txProd.objectStore('products').getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    const lastProd = products[products.length - 1];
    console.log('📦 Último produto:', lastProd?.nome, '- ID:', lastProd?.id?.slice(0, 8));
    
    // Ler movimentos
    const txMov = db.transaction(['stock_movements'], 'readonly');
    const movements = await new Promise((resolve) => {
      const req = txMov.objectStore('stock_movements').getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    const prodMovements = movements.filter(m => 
      m.produtoId === lastProd?.id || m.produto_id === lastProd?.id
    );
    console.log('📋 Movimentos do produto:', prodMovements.length);
    
    // Ler stock_balance
    const txBal = db.transaction(['stock_balance'], 'readonly');
    const balances = await new Promise((resolve) => {
      const req = txBal.objectStore('stock_balance').getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    const prodBalance = balances.find(b => b.product_id === lastProd?.id);
    console.log('📊 Stock Balance:', prodBalance ? 
      `Quantidade: ${prodBalance.quantidade_atual}` : 
      '❌ NÃO ENCONTRADO');
    
    if (prodBalance && prodBalance.quantidade_atual > 0) {
      console.log('✅ ESTOQUE OK!');
    } else if (prodBalance) {
      console.log('⚠️ Estoque registrado mas quantidade = 0');
    } else {
      console.log('❌ Nenhum registro de estoque encontrado');
    }
    
    db.close();
  };
})();
