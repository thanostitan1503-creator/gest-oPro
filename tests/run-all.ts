/**
 * 🧪 SUITE COMPLETA DE TESTES DO SISTEMA
 * 
 * Executa todos os testes de validação das correções implementadas:
 * 1. Sistema de Login (Repository Pattern)
 * 2. Sistema EXCHANGE (Logística Reversa)
 * 3. Fechamento de Caixa (Blind Closing)
 * 
 * Executar: npm run test
 * ou: node tests/run-all.ts
 */

import './setup'; // Configurar fake-indexeddb ANTES de importar Dexie
import { testLoginSystem, clearTestData as clearLogin } from './login.test';
import { testExchangeSystem, clearTestData as clearExchange } from './exchange.test';
import { testShiftClosingSystem, clearTestData as clearShift } from './shift-closing.test';
import { db } from '../domain/db';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader(title: string) {
  const line = '='.repeat(70);
  log(`\n${line}`, colors.cyan + colors.bold);
  log(`  ${title}`, colors.cyan + colors.bold);
  log(`${line}\n`, colors.cyan + colors.bold);
}

function printSummary(results: { passed: number; total: number; success: boolean }[], totalTime: number) {
  const line = '='.repeat(70);
  log(`\n${line}`, colors.bold);
  log('📊 RELATÓRIO CONSOLIDADO DE TESTES', colors.bold + colors.cyan);
  log(line, colors.bold);

  const totalPassed = results.reduce((acc, r) => acc + r.passed, 0);
  const totalTests = results.reduce((acc, r) => acc + r.total, 0);
  const allSuccess = results.every((r) => r.success);

  log(`\n📈 Estatísticas Gerais:`, colors.bold);
  log(`   • Testes executados: ${totalTests}`);
  log(`   • Testes aprovados: ${totalPassed}`, colors.green);
  log(`   • Testes falhados: ${totalTests - totalPassed}`, totalTests === totalPassed ? colors.green : colors.red);
  log(`   • Taxa de sucesso: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
  log(`   • Tempo total: ${totalTime.toFixed(2)}s\n`);

  log('📋 Detalhamento por Módulo:', colors.bold);
  
  const modules = [
    { name: '🔐 Sistema de Login', result: results[0] },
    { name: '⚙️  Sistema EXCHANGE', result: results[1] },
    { name: '💰 Fechamento de Caixa', result: results[2] },
  ];

  modules.forEach((module, idx) => {
    const icon = module.result.success ? '✅' : '❌';
    const color = module.result.success ? colors.green : colors.red;
    log(`   ${icon} ${module.name}: ${module.result.passed}/${module.result.total}`, color);
  });

  log(`\n${line}`, colors.bold);
  
  if (allSuccess) {
    log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!', colors.green + colors.bold);
    log('✨ O sistema está pronto para produção.', colors.green);
  } else {
    log('⚠️  ALGUNS TESTES FALHARAM', colors.yellow + colors.bold);
    log('🔧 Revise os erros acima antes de implantar.', colors.yellow);
  }
  
  log(`${line}\n`, colors.bold);

  return allSuccess;
}

async function runAllTests() {
  const startTime = Date.now();
  
  printHeader('🧪 BATERIA COMPLETA DE TESTES - SISTEMA ERP GÁS');
  
  log('📦 Inicializando banco de dados...', colors.blue);
  try {
    await db.open();
    log('✅ Banco Dexie conectado\n', colors.green);
  } catch (err) {
    log(`❌ Erro ao conectar ao banco: ${(err as Error).message}`, colors.red);
    process.exit(1);
  }

  const results: { passed: number; total: number; success: boolean }[] = [];

  // ==================== TEST 1: LOGIN ====================
  try {
    printHeader('TESTE 1/3: Sistema de Login');
    await clearLogin();
    const result = await testLoginSystem();
    results.push(result);
  } catch (err) {
    log(`❌ Erro fatal no teste de Login: ${(err as Error).message}`, colors.red);
    results.push({ passed: 0, total: 7, success: false });
  }

  // ==================== TEST 2: EXCHANGE ====================
  try {
    printHeader('TESTE 2/3: Sistema EXCHANGE');
    await clearExchange();
    const result = await testExchangeSystem();
    results.push(result);
  } catch (err) {
    log(`❌ Erro fatal no teste de EXCHANGE: ${(err as Error).message}`, colors.red);
    results.push({ passed: 0, total: 7, success: false });
  }

  // ==================== TEST 3: SHIFT CLOSING ====================
  try {
    printHeader('TESTE 3/3: Fechamento de Caixa');
    await clearShift();
    const result = await testShiftClosingSystem();
    results.push(result);
  } catch (err) {
    log(`❌ Erro fatal no teste de Fechamento: ${(err as Error).message}`, colors.red);
    results.push({ passed: 0, total: 8, success: false });
  }

  // ==================== SUMMARY ====================
  const totalTime = (Date.now() - startTime) / 1000;
  const allSuccess = printSummary(results, totalTime);

  // Exit with appropriate code
  process.exit(allSuccess ? 0 : 1);
}

// Execute
runAllTests().catch((err) => {
  log(`\n💥 ERRO FATAL DURANTE EXECUÇÃO DOS TESTES`, colors.red + colors.bold);
  console.error(err);
  process.exit(1);
});
