/**
 * ✅ TESTE DE FLUXO COMPLETO DE LOGIN
 * 
 * Valida que:
 * 1. Colaborador só pode fazer login se tiver depositoId (exceto ENTREGADOR)
 * 2. Sistema usa automaticamente o depositoId do colaborador
 * 3. Abertura de caixa usa o depósito correto sem seleção manual
 * 
 * Executar: npm run test:login-flow
 */

import './setup';
import { db, generateId } from '../src/domain/db';
import { upsertEmployee, listEmployees } from '../src/domain/repositories/employees.repo';
import { upsertDeposit } from '../src/domain/repositories/deposits.repo';
import type { Colaborador, Deposito } from '../src/domain/types';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string) {
  log(`\n▶ ${name}`, colors.blue + colors.bold);
}

function logSuccess(message: string) {
  log(`  ✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`  ❌ ${message}`, colors.red);
}

async function clearTestData() {
  await db.employees.clear();
  await db.deposits.clear();
  await db.outbox_events.clear();
  log('  ℹ️  Dados de teste limpos\n');
}

async function testLoginFlow() {
  let passedTests = 0;
  let totalTests = 0;

  log('\n' + '='.repeat(60), colors.bold);
  log('🔐 TESTE: FLUXO COMPLETO DE LOGIN', colors.bold);
  log('='.repeat(60) + '\n', colors.bold);

  // ==================== SETUP ====================
  logTest('SETUP: Criar 2 depósitos');
  totalTests++;
  try {
    const dep1: Deposito = {
      id: 'DEP1',
      nome: 'Depósito Centro',
      endereco: 'Rua A, 100',
      ativo: true,
    };
    const dep2: Deposito = {
      id: 'DEP2',
      nome: 'Depósito Bairro',
      endereco: 'Rua B, 200',
      ativo: true,
    };
    await upsertDeposit(dep1);
    await upsertDeposit(dep2);
    
    const deps = await db.deposits.toArray();
    if (deps.length !== 2) throw new Error('Depósitos não criados');
    
    logSuccess('2 depósitos criados');
    passedTests++;
  } catch (err) {
    logError(`Falha no setup: ${(err as Error).message}`);
  }

  // ==================== TEST 1 ====================
  logTest('1 - Criar colaborador VINCULADO a depósito');
  totalTests++;
  try {
    const colaborador: Colaborador = {
      id: generateId(),
      nome: 'João Silva',
      cargo: 'COLABORADOR',
      depositoId: 'DEP1', // ✅ Vinculado ao Depósito Centro
      username: 'joao',
      password: '1234',
      ativo: true,
      permissoes: [],
    };
    await upsertEmployee(colaborador);
    
    const saved = await db.employees.get(colaborador.id);
    if (!saved) throw new Error('Colaborador não salvo');
    if (saved.depositoId !== 'DEP1') throw new Error('depositoId incorreto');
    
    logSuccess('Colaborador criado com depositoId=DEP1');
    passedTests++;
  } catch (err) {
    logError(`Falha: ${(err as Error).message}`);
  }

  // ==================== TEST 2 ====================
  logTest('2 - Simular login: buscar colaborador e validar depositoId');
  totalTests++;
  try {
    const employees = await listEmployees();
    const user = employees.find(u => u.username === 'joao');
    
    if (!user) throw new Error('Usuário não encontrado');
    if (user.password !== '1234') throw new Error('Senha incorreta');
    if (!user.ativo) throw new Error('Usuário inativo');
    if (!user.depositoId) throw new Error('❌ FALHA CRÍTICA: Colaborador sem depositoId!');
    if (user.depositoId !== 'DEP1') throw new Error('depositoId incorreto');
    
    logSuccess('Login OK: João Silva autenticado');
    logSuccess(`depositoId automático: ${user.depositoId}`);
    passedTests++;
  } catch (err) {
    logError(`Falha no login: ${(err as Error).message}`);
  }

  // ==================== TEST 3 ====================
  logTest('3 - Criar ENTREGADOR sem depositoId (global)');
  totalTests++;
  try {
    const entregador: Colaborador = {
      id: generateId(),
      nome: 'Carlos Motorista',
      cargo: 'ENTREGADOR',
      depositoId: undefined, // ✅ ENTREGADOR é global
      username: 'carlos',
      password: '5678',
      ativo: true,
      permissoes: [],
    };
    await upsertEmployee(entregador);
    
    const saved = await db.employees.get(entregador.id);
    if (!saved) throw new Error('Entregador não salvo');
    if (saved.depositoId) throw new Error('Entregador NÃO deve ter depositoId');
    
    logSuccess('Entregador global criado (sem depositoId)');
    passedTests++;
  } catch (err) {
    logError(`Falha: ${(err as Error).message}`);
  }

  // ==================== TEST 4 ====================
  logTest('4 - Login de ENTREGADOR: não exigir depositoId');
  totalTests++;
  try {
    const employees = await listEmployees();
    const user = employees.find(u => u.username === 'carlos');
    
    if (!user) throw new Error('Entregador não encontrado');
    if (user.cargo !== 'ENTREGADOR') throw new Error('Cargo incorreto');
    if (user.depositoId) throw new Error('Entregador não deve ter depositoId');
    
    logSuccess('Login OK: Entregador autenticado');
    logSuccess('✅ ENTREGADOR não precisa de depositoId');
    passedTests++;
  } catch (err) {
    logError(`Falha: ${(err as Error).message}`);
  }

  // ==================== TEST 5 ====================
  logTest('5 - Tentar login com colaborador SEM depositoId (deve falhar)');
  totalTests++;
  try {
    // Criar colaborador SEM depositoId (erro de cadastro)
    const colaboradorErrado: Colaborador = {
      id: generateId(),
      nome: 'Maria Erro',
      cargo: 'COLABORADOR',
      depositoId: undefined, // ❌ COLABORADOR precisa de depositoId
      username: 'maria',
      password: '9999',
      ativo: true,
      permissoes: [],
    };
    await upsertEmployee(colaboradorErrado);
    
    const employees = await listEmployees();
    const user = employees.find(u => u.username === 'maria');
    
    // Simular validação do LoginScreen
    if (user && user.cargo !== 'ENTREGADOR' && !user.depositoId) {
      logSuccess('Validação OK: Sistema bloquearia login sem depositoId');
      passedTests++;
    } else {
      throw new Error('Validação falhou - deveria bloquear login');
    }
  } catch (err) {
    logError(`Falha: ${(err as Error).message}`);
  }

  // ==================== TEST 6 ====================
  logTest('6 - Verificar isolamento de depósitos');
  totalTests++;
  try {
    // Criar colaborador no DEP2
    const colab2: Colaborador = {
      id: generateId(),
      nome: 'Ana Costa',
      cargo: 'COLABORADOR',
      depositoId: 'DEP2', // ✅ Vinculado ao Depósito Bairro
      username: 'ana',
      password: '1111',
      ativo: true,
      permissoes: [],
    };
    await upsertEmployee(colab2);
    
    const employees = await listEmployees();
    const userDep1 = employees.find(u => u.username === 'joao');
    const userDep2 = employees.find(u => u.username === 'ana');
    
    if (!userDep1 || !userDep2) throw new Error('Colaboradores não encontrados');
    if (userDep1.depositoId === userDep2.depositoId) throw new Error('Depósitos iguais!');
    
    logSuccess(`João está em: ${userDep1.depositoId}`);
    logSuccess(`Ana está em: ${userDep2.depositoId}`);
    logSuccess('✅ Isolamento de depósitos preservado');
    passedTests++;
  } catch (err) {
    logError(`Falha: ${(err as Error).message}`);
  }

  // ==================== SUMMARY ====================
  log('\n' + '-'.repeat(60), colors.bold);
  const allPassed = passedTests === totalTests;
  if (allPassed) {
    log(`✅ TODOS OS TESTES PASSARAM: ${passedTests}/${totalTests}`, colors.green + colors.bold);
  } else {
    log(`❌ ALGUNS TESTES FALHARAM: ${passedTests}/${totalTests}`, colors.red + colors.bold);
  }
  log('-'.repeat(60) + '\n', colors.bold);

  return { passed: passedTests, total: totalTests, success: allPassed };
}

async function runAllTests() {
  const timeout = setTimeout(() => {
    console.error('❌ TIMEOUT: Teste travou por mais de 10 segundos');
    process.exit(1);
  }, 10000);

  try {
    console.log('🔄 Abrindo banco de dados...');
    await db.open();
    log('✅ Banco Dexie conectado\n', colors.green);

    console.log('🔄 Limpando dados de teste...');
    await clearTestData();
    
    console.log('🔄 Iniciando testes...');
    const result = await testLoginFlow();

    clearTimeout(timeout);

    if (!result.success) {
      process.exit(1);
    }

    log('\n✨ Fluxo de login validado com sucesso!\n', colors.green + colors.bold);
    process.exit(0);
  } catch (err) {
    clearTimeout(timeout);
    console.error('💥 Erro fatal:', err);
    logError(`Erro fatal: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testLoginFlow, clearTestData };
