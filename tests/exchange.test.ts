/**
 * ✅ TESTES DO SISTEMA EXCHANGE (LOGÍSTICA REVERSA)
 * 
 * Valida as correções implementadas em:
 * - stock.logic.ts (normalizeMovementType e resolveReturnProduct)
 * - serviceOrders.repo.ts (processamento de movimentos ao concluir OS)
 * 
 * Executar: node tests/exchange.test.ts
 */

import './setup'; // Configurar fake-indexeddb
import { db, generateId } from '@/domain/db';
import { createProduct, listProducts } from '@/domain/repositories/products.repo';
import { upsertServiceOrder } from '@/domain/repositories/serviceOrders.repo';
import { applyMovement, getStockQty } from '@/domain/repositories/stock.repo';
import { calcularMovimentosEstoque } from '@/domain/stock.logic';
import type { Produto, OrdemServico, MovimentoEstoque } from '@/domain/types';

// ==================== HELPER FUNCTIONS ====================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string) {
  log(`\n${colors.bold}▶ ${name}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`  ✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`  ❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`  ℹ️  ${message}`, colors.blue);
}

async function clearTestData() {
  await db.products.clear();
  await db.service_orders.clear();
  await db.service_order_items.clear();
  await db.stock_movements.clear();
  await db.stock_balance.clear();
  await db.outbox_events.clear();
  logInfo('Dados de teste limpos');
}

// ==================== TEST SUITE ====================

async function testExchangeSystem() {
  log('\n' + '='.repeat(60), colors.bold);
  log('⚙️ TESTE 2: SISTEMA EXCHANGE (Logística Reversa)', colors.bold);
  log('='.repeat(60), colors.bold);

  let passedTests = 0;
  let totalTests = 0;
  const DEPOSIT_ID = 'DEP_TEST';

  // Test 2.1: Criar produto vazio (vasilhame)
  logTest('2.1 - Criar produto de retorno (vasilhame vazio)');
  totalTests++;
  let emptyProductId = '';
  try {
    const emptyProduct: Partial<Produto> = {
      nome: 'Vasilhame Vazio P13',
      tipo: 'VASILHAME_VAZIO',
      deposit_id: DEPOSIT_ID,
      preco_venda: 15.0,
      preco_custo: 0,
      preco_padrao: 15.0,
      ativo: true,
      movement_type: 'SIMPLE',
      track_stock: true,
      return_product_id: null,
    };

    const created = await createProduct(emptyProduct as any);
    emptyProductId = created.id;

    if (!created.id) throw new Error('ID não gerado');
    if (created.movement_type !== 'SIMPLE') throw new Error('Movement type incorreto');

    logSuccess(`Vasilhame criado: ${created.nome} (ID: ${created.id.slice(0, 8)}...)`);
    passedTests++;
  } catch (err) {
    logError(`Falha ao criar vasilhame: ${(err as Error).message}`);
  }

  // Test 2.2: Criar produto cheio com vinculação EXCHANGE
  logTest('2.2 - Criar produto cheio com movement_type=EXCHANGE');
  totalTests++;
  let fullProductId = '';
  try {
    const fullProduct: Partial<Produto> = {
      nome: 'Gás P13 Cheio',
      tipo: 'GAS_CHEIO',
      deposit_id: DEPOSIT_ID,
      preco_venda: 80.0,
      preco_custo: 50.0,
      preco_padrao: 80.0,
      ativo: true,
      movement_type: 'EXCHANGE',
      track_stock: true,
      return_product_id: emptyProductId, // Vinculação crítica
    };

    const created = await createProduct(fullProduct as any);
    fullProductId = created.id;

    if (created.movement_type !== 'EXCHANGE') throw new Error('Movement type não é EXCHANGE');
    if (created.return_product_id !== emptyProductId) throw new Error('return_product_id não vinculado');

    logSuccess(`Produto cheio criado: ${created.nome} (vinculado ao vasilhame)`);
    passedTests++;
  } catch (err) {
    logError(`Falha ao criar produto cheio: ${(err as Error).message}`);
  }

  // Test 2.3: Adicionar estoque inicial
  logTest('2.3 - Adicionar estoque inicial aos produtos');
  totalTests++;
  try {
    const movementFull: MovimentoEstoque = {
      id: generateId(),
      dataHora: new Date().toISOString(),
      depositoId: DEPOSIT_ID,
      produtoId: fullProductId,
      produtoNome: 'Gás P13 Cheio',
      tipo: 'ENTRADA',
      quantidade: 10,
      origem: 'AJUSTE_MANUAL',
      usuarioId: 'SYSTEM',
      usuarioNome: 'Sistema',
      motivo: 'Estoque inicial para teste',
    };

    const movementEmpty: MovimentoEstoque = {
      id: generateId(),
      dataHora: new Date().toISOString(),
      depositoId: DEPOSIT_ID,
      produtoId: emptyProductId,
      produtoNome: 'Vasilhame Vazio P13',
      tipo: 'ENTRADA',
      quantidade: 5,
      origem: 'AJUSTE_MANUAL',
      usuarioId: 'SYSTEM',
      usuarioNome: 'Sistema',
      motivo: 'Estoque inicial para teste',
    };

    await applyMovement(movementFull);
    await applyMovement(movementEmpty);

    const stockFull = await getStockQty(DEPOSIT_ID, fullProductId);
    const stockEmpty = await getStockQty(DEPOSIT_ID, emptyProductId);

    if (stockFull !== 10) throw new Error(`Estoque cheio incorreto: ${stockFull} (esperado 10)`);
    if (stockEmpty !== 5) throw new Error(`Estoque vazio incorreto: ${stockEmpty} (esperado 5)`);

    logSuccess(`Estoque inicial: ${stockFull} cheios, ${stockEmpty} vazios`);
    passedTests++;
  } catch (err) {
    logError(`Falha ao adicionar estoque: ${(err as Error).message}`);
  }

  // Test 2.4: Testar calcularMovimentosEstoque (lógica pura)
  logTest('2.4 - Testar cálculo de movimentos EXCHANGE');
  totalTests++;
  try {
    const produtos = await listProducts();

    const mockOS: OrdemServico = {
      id: 'OS_TEST_001',
      numeroOs: 'TEST-001',
      depositoId: DEPOSIT_ID,
      clienteId: 'CLIENT_TEST',
      clienteNome: 'Cliente Teste',
      clienteTelefone: '(62) 99999-9999',
      enderecoEntrega: 'Rua Teste, 123',
      tipoAtendimento: 'DELIVERY',
      status: 'CONCLUIDA',
      total: 80.0,
      dataHoraCriacao: Date.now(),
      itens: [
        {
          id: generateId(),
          produtoId: fullProductId,
          quantidade: 2,
          precoUnitario: 80.0,
          modalidade: 'VENDA',
        },
      ],
      pagamentos: [
        {
          formaPagamentoId: 'PIX',
          valor: 160.0,
        },
      ],
      historico: [],
    };

    const movimentos = calcularMovimentosEstoque(mockOS, produtos, 'OS', false);

    if (movimentos.length !== 2) {
      throw new Error(`Esperado 2 movimentos, gerou ${movimentos.length}`);
    }

    const saidaCheia = movimentos.find((m) => m.produtoId === fullProductId && m.tipo === 'SAIDA');
    const entradaVazia = movimentos.find((m) => m.produtoId === emptyProductId && m.tipo === 'ENTRADA');

    if (!saidaCheia) throw new Error('Movimento de SAIDA do produto cheio não gerado');
    if (!entradaVazia) throw new Error('Movimento de ENTRADA do vasilhame vazio não gerado');

    if (saidaCheia.quantidade !== 2) throw new Error(`Quantidade SAIDA incorreta: ${saidaCheia.quantidade}`);
    if (entradaVazia.quantidade !== 2) throw new Error(`Quantidade ENTRADA incorreta: ${entradaVazia.quantidade}`);

    logSuccess('Movimentos EXCHANGE calculados corretamente');
    logInfo(`  - SAIDA: 2x ${saidaCheia.produtoNome}`);
    logInfo(`  - ENTRADA: 2x ${entradaVazia.produtoNome}`);
    passedTests++;
  } catch (err) {
    logError(`Falha no cálculo de movimentos: ${(err as Error).message}`);
  }

  // Test 2.5: Criar e concluir OS real com EXCHANGE
  logTest('2.5 - Criar e concluir Ordem de Serviço com produto EXCHANGE');
  totalTests++;
  try {
    const realOS: OrdemServico = {
      id: generateId(),
      numeroOs: 'TEST-002',
      depositoId: DEPOSIT_ID,
      clienteId: 'CLIENT_REAL',
      clienteNome: 'Cliente Real',
      clienteTelefone: '(62) 98888-8888',
      enderecoEntrega: 'Av. Principal, 456',
      tipoAtendimento: 'DELIVERY',
      status: 'CONCLUIDA', // Já concluída para disparar movimentação
      total: 240.0,
      dataHoraCriacao: Date.now(),
      itens: [
        {
          id: generateId(),
          produtoId: fullProductId,
          quantidade: 3,
          precoUnitario: 80.0,
          modalidade: 'VENDA',
        },
      ],
      pagamentos: [
        {
          formaPagamentoId: 'DINHEIRO',
          valor: 240.0,
        },
      ],
      historico: [],
    };

    await upsertServiceOrder(realOS);

    // Aguardar processamento assíncrono
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stockFullAfter = await getStockQty(DEPOSIT_ID, fullProductId);
    const stockEmptyAfter = await getStockQty(DEPOSIT_ID, emptyProductId);

    // Estoque inicial: 10 cheios, 5 vazios
    // Após venda de 3 cheios: 7 cheios, 8 vazios
    if (stockFullAfter !== 7) throw new Error(`Estoque cheio pós-venda incorreto: ${stockFullAfter} (esperado 7)`);
    if (stockEmptyAfter !== 8) throw new Error(`Estoque vazio pós-venda incorreto: ${stockEmptyAfter} (esperado 8)`);

    logSuccess('OS concluída: estoque atualizado corretamente');
    logInfo(`  - Cheios: 10 → ${stockFullAfter} (-3 vendidos)`);
    logInfo(`  - Vazios: 5 → ${stockEmptyAfter} (+3 retornados)`);
    passedTests++;
  } catch (err) {
    logError(`Falha ao processar OS: ${(err as Error).message}`);
  }

  // Test 2.6: Validar movimentos gerados no banco
  logTest('2.6 - Validar movimentos registrados no banco');
  totalTests++;
  try {
    const movements = await db.stock_movements
      .where('origem')
      .equals('OS')
      .and((m) => m.depositoId === DEPOSIT_ID)
      .toArray();

    if (movements.length < 2) {
      throw new Error(`Movimentos insuficientes no banco: ${movements.length} (esperado >= 2)`);
    }

    const saidaCount = movements.filter((m) => m.tipo === 'SAIDA' && m.produtoId === fullProductId).length;
    const entradaCount = movements.filter((m) => m.tipo === 'ENTRADA' && m.produtoId === emptyProductId).length;

    if (saidaCount === 0) throw new Error('Nenhum movimento de SAIDA registrado');
    if (entradaCount === 0) throw new Error('Nenhum movimento de ENTRADA registrado');

    logSuccess(`${movements.length} movimentos registrados no banco`);
    logInfo(`  - ${saidaCount} SAIDA(s) de produto cheio`);
    logInfo(`  - ${entradaCount} ENTRADA(s) de vasilhame`);
    passedTests++;
  } catch (err) {
    logError(`Falha na validação do banco: ${(err as Error).message}`);
  }

  // Test 2.7: Testar produto SIMPLE (sem retorno)
  logTest('2.7 - Testar produto SIMPLE (sem logística reversa)');
  totalTests++;
  try {
    const simpleProduct: Partial<Produto> = {
      nome: 'Água Mineral 20L',
      tipo: 'AGUA',
      deposit_id: DEPOSIT_ID,
      preco_venda: 10.0,
      preco_custo: 5.0,
      preco_padrao: 10.0,
      ativo: true,
      movement_type: 'SIMPLE',
      track_stock: true,
      return_product_id: null,
    };

    const created = await createProduct(simpleProduct as any);

    // Adicionar estoque
    await applyMovement({
      id: generateId(),
      dataHora: new Date().toISOString(),
      depositoId: DEPOSIT_ID,
      produtoId: created.id,
      produtoNome: created.nome,
      tipo: 'ENTRADA',
      quantidade: 20,
      origem: 'AJUSTE_MANUAL',
      usuarioId: 'SYSTEM',
      usuarioNome: 'Sistema',
      motivo: 'Estoque inicial',
    });

    const produtos = await listProducts();
    const mockOSSimple: OrdemServico = {
      id: generateId(),
      numeroOs: 'TEST-003',
      depositoId: DEPOSIT_ID,
      clienteId: 'CLIENT_TEST',
      clienteNome: 'Cliente Teste',
      clienteTelefone: '(62) 99999-9999',
      enderecoEntrega: 'Rua Teste, 789',
      tipoAtendimento: 'DELIVERY',
      status: 'CONCLUIDA',
      total: 30.0,
      dataHoraCriacao: Date.now(),
      itens: [
        {
          id: generateId(),
          produtoId: created.id,
          quantidade: 3,
          precoUnitario: 10.0,
          modalidade: 'VENDA',
        },
      ],
      pagamentos: [],
      historico: [],
    };

    const movimentos = calcularMovimentosEstoque(mockOSSimple, produtos, 'OS', false);

    if (movimentos.length !== 1) {
      throw new Error(`Produto SIMPLE deveria gerar 1 movimento, gerou ${movimentos.length}`);
    }

    const saida = movimentos[0];
    if (saida.tipo !== 'SAIDA') throw new Error('Tipo de movimento incorreto para SIMPLE');
    if (saida.quantidade !== 3) throw new Error('Quantidade incorreta');

    logSuccess('Produto SIMPLE processado corretamente (apenas SAIDA)');
    passedTests++;
  } catch (err) {
    logError(`Falha no teste SIMPLE: ${(err as Error).message}`);
  }

  // Summary
  log('\n' + '-'.repeat(60), colors.bold);
  const success = passedTests === totalTests;
  if (success) {
    log(`✅ TODOS OS TESTES PASSARAM: ${passedTests}/${totalTests}`, colors.green + colors.bold);
  } else {
    log(`❌ ALGUNS TESTES FALHARAM: ${passedTests}/${totalTests}`, colors.red + colors.bold);
  }
  log('-'.repeat(60) + '\n', colors.bold);

  return { passed: passedTests, total: totalTests, success };
}

// ==================== MAIN EXECUTION ====================

async function runAllTests() {
  try {
    await db.open();
    log('\n🚀 Iniciando bateria de testes do sistema EXCHANGE...', colors.blue + colors.bold);

    await clearTestData();

    const result = await testExchangeSystem();

    if (!result.success) {
      process.exit(1);
    }

    log('\n✨ Bateria de testes concluída com sucesso!\n', colors.green + colors.bold);
    process.exit(0);
  } catch (err) {
    logError(`Erro fatal: ${(err as Error).message}`);
    console.error(err);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testExchangeSystem, clearTestData };
