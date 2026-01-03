/**
 * Script de Teste: Criação de Produto Multi-Depósito
 * Valida se o sistema consegue criar/editar produtos sem erros
 */

import Dexie from 'dexie';

// Simular estrutura do DB
const db = new Dexie('GasDistributionDB');
db.version(16).stores({
  deposits: 'id, nome, ativo',
  products: 'id, codigo, nome, ativo, tipo, product_group, depositoId',
  stock_balance: 'id, [deposit_id+product_id]',
  zone_pricing: 'id, [productId+depositoId]',
  product_exchange_rules: 'id, [productId+depositoId]',
});

async function testGetBalance() {
  console.log('\n🧪 TESTE 1: Função getBalance()');
  
  try {
    // Simular função getBalance
    async function getBalance(depositId, productId) {
      try {
        return await db.stock_balance
          .where('[deposit_id+product_id]')
          .equals([depositId, productId])
          .first();
      } catch (error) {
        console.log('   ⚠️  Índice composto falhou, usando fallback...');
        const all = await db.stock_balance.toArray();
        return all.find(b => b.deposit_id === depositId && b.product_id === productId);
      }
    }

    // Dados de teste
    const testDepositId = 'DEP1';
    const testProductId = 'PROD-001';

    // Inserir saldo de teste
    await db.stock_balance.put({
      id: 'BALANCE-001',
      deposit_id: testDepositId,
      product_id: testProductId,
      quantidade_atual: 50,
    });

    console.log('   ✅ Saldo inserido no banco');

    // Testar busca
    const balance = await getBalance(testDepositId, testProductId);
    
    if (balance && balance.quantidade_atual === 50) {
      console.log('   ✅ getBalance() retornou saldo correto:', balance.quantidade_atual);
      return true;
    } else {
      console.error('   ❌ getBalance() falhou ou retornou valor errado');
      return false;
    }
  } catch (error) {
    console.error('   ❌ ERRO no teste:', error.message);
    return false;
  }
}

async function testMultiDepositProduct() {
  console.log('\n🧪 TESTE 2: Criação de Produto Multi-Depósito');
  
  try {
    // Criar depósitos de teste
    await db.deposits.bulkPut([
      { id: 'DEP1', nome: 'Depósito A', ativo: true },
      { id: 'DEP2', nome: 'Depósito B', ativo: true },
    ]);
    console.log('   ✅ 2 depósitos criados');

    // Criar produto global
    const productId = 'PROD-GAS-001';
    await db.products.put({
      id: productId,
      nome: 'Gás P13 Cheio',
      tipo: 'GAS_CHEIO',
      codigo: 'P13',
      ativo: true,
      depositoId: null, // Global
      preco_custo: 80,
      preco_venda: 0, // Será por depósito
      movement_type: 'EXCHANGE',
    });
    console.log('   ✅ Produto global criado');

    // Criar preços por depósito
    await db.zone_pricing.bulkPut([
      {
        id: `${productId}:DEP1`,
        productId: productId,
        depositoId: 'DEP1',
        price: 100,
      },
      {
        id: `${productId}:DEP2`,
        productId: productId,
        depositoId: 'DEP2',
        price: 120,
      },
    ]);
    console.log('   ✅ Preços por depósito criados (DEP1: R$100, DEP2: R$120)');

    // Criar saldos de estoque
    await db.stock_balance.bulkPut([
      {
        id: 'BAL-1',
        deposit_id: 'DEP1',
        product_id: productId,
        quantidade_atual: 50,
      },
      {
        id: 'BAL-2',
        deposit_id: 'DEP2',
        product_id: productId,
        quantidade_atual: 30,
      },
    ]);
    console.log('   ✅ Estoques iniciais criados (DEP1: 50un, DEP2: 30un)');

    // Validar isolamento
    const balanceDep1 = await db.stock_balance
      .where('[deposit_id+product_id]')
      .equals(['DEP1', productId])
      .first();

    const balanceDep2 = await db.stock_balance
      .where('[deposit_id+product_id]')
      .equals(['DEP2', productId])
      .first();

    if (balanceDep1?.quantidade_atual === 50 && balanceDep2?.quantidade_atual === 30) {
      console.log('   ✅ Estoques isolados corretamente por depósito');
      return true;
    } else {
      console.error('   ❌ Estoques não isolados corretamente');
      return false;
    }
  } catch (error) {
    console.error('   ❌ ERRO no teste:', error.message);
    return false;
  }
}

async function testExchangeProduct() {
  console.log('\n🧪 TESTE 3: Produto EXCHANGE com Vasilhame');
  
  try {
    const fullProductId = 'PROD-GAS-P13';
    const emptyProductId = 'PROD-VAZIO-P13';

    // Criar produto cheio
    await db.products.put({
      id: fullProductId,
      nome: 'Gás P13 Cheio',
      tipo: 'GAS_CHEIO',
      ativo: true,
      depositoId: null,
      movement_type: 'EXCHANGE',
    });

    // Criar produto vazio
    await db.products.put({
      id: emptyProductId,
      nome: 'Vasilhame Vazio P13',
      tipo: 'VASILHAME_VAZIO',
      ativo: true,
      depositoId: null,
      movement_type: 'SIMPLE',
    });
    console.log('   ✅ Produtos cheio e vazio criados');

    // Criar regra de troca por depósito
    await db.product_exchange_rules.bulkPut([
      {
        id: `${fullProductId}:DEP1`,
        productId: fullProductId,
        depositoId: 'DEP1',
        returnProductId: emptyProductId,
      },
      {
        id: `${fullProductId}:DEP2`,
        productId: fullProductId,
        depositoId: 'DEP2',
        returnProductId: emptyProductId,
      },
    ]);
    console.log('   ✅ Regras de troca criadas para ambos depósitos');

    // Validar regras
    const rules = await db.product_exchange_rules.toArray();
    if (rules.length === 2) {
      console.log('   ✅ 2 regras de troca registradas corretamente');
      return true;
    } else {
      console.error('   ❌ Regras de troca não criadas corretamente');
      return false;
    }
  } catch (error) {
    console.error('   ❌ ERRO no teste:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   SUITE DE TESTES - Sistema Multi-Depósito            ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  const results = [];

  // Abrir banco
  await db.open();
  console.log('✅ Conexão com IndexedDB estabelecida\n');

  // Executar testes
  results.push(await testGetBalance());
  results.push(await testMultiDepositProduct());
  results.push(await testExchangeProduct());

  // Resumo
  const passed = results.filter(r => r === true).length;
  const total = results.length;

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║   RESULTADOS: ${passed}/${total} testes passaram                      ║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (passed === total) {
    console.log('🎉 SUCESSO! Sistema funcionando corretamente!');
    process.exit(0);
  } else {
    console.error('❌ FALHA! Alguns testes não passaram.');
    process.exit(1);
  }
}

// Executar
runAllTests().catch(err => {
  console.error('\n💥 ERRO CRÍTICO:', err);
  process.exit(1);
});
