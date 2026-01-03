/**
 * ✅ TESTES DE AUTENTICAÇÃO E GESTÃO DE USUÁRIOS
 * 
 * Valida as correções implementadas em:
 * - LoginScreen.tsx (migração de storage.ts para repository pattern)
 * - EmployeesModule.tsx (uso de useLiveQuery + repositories)
 * 
 * Executar: node tests/login.test.ts
 */

import './setup'; // Configurar fake-indexeddb
import { db, generateId } from '../src/domain/db';
import { listEmployees, upsertEmployee, deleteEmployee } from '../src/domain/repositories/employees.repo';
import type { Colaborador } from '../src/domain/types';

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
  await db.employees.clear();
  await db.outbox_events.clear();
  logInfo('Dados de teste limpos');
}

// ==================== TEST SUITE ====================

async function testLoginSystem() {
  log('\n' + '='.repeat(60), colors.bold);
  log('🔐 TESTE 1: SISTEMA DE LOGIN (Repository Pattern)', colors.bold);
  log('='.repeat(60), colors.bold);

  let passedTests = 0;
  let totalTests = 0;

  // Test 1.1: Criar usuário via repository
  logTest('1.1 - Criar usuário usando upsertEmployee()');
  totalTests++;
  try {
    const newUser: Colaborador = {
      id: generateId(),
      nome: 'João Silva',
      cargo: 'GERENTE',
      depositoId: 'DEP1',
      ativo: true,
      username: 'joao.silva',
      password: 'senha123',
      permissoes: ['produtos', 'clientes', 'vendas'],
    };

    const created = await upsertEmployee(newUser);

    if (!created.id) throw new Error('ID não gerado');
    if (created.nome !== 'João Silva') throw new Error('Nome incorreto');
    if (created.username !== 'joao.silva') throw new Error('Username incorreto');

    logSuccess('Usuário criado com sucesso no Dexie');
    passedTests++;

    // Verificar se foi enfileirado no outbox
    const outboxCount = await db.outbox_events
      .where('entity')
      .equals('employees')
      .and((e) => e.entity_id === created.id)
      .count();

    if (outboxCount === 0) throw new Error('Outbox não foi criado');
    logSuccess('Evento enfileirado no outbox para sincronização');
  } catch (err) {
    logError(`Falha ao criar usuário: ${(err as Error).message}`);
  }

  // Test 1.2: Listar usuários via repository
  logTest('1.2 - Listar usuários usando listEmployees()');
  totalTests++;
  try {
    const employees = await listEmployees();

    if (employees.length === 0) throw new Error('Nenhum usuário encontrado');
    if (!employees.find((e) => e.username === 'joao.silva')) {
      throw new Error('Usuário criado não aparece na listagem');
    }

    logSuccess(`${employees.length} usuário(s) encontrado(s)`);
    passedTests++;
  } catch (err) {
    logError(`Falha ao listar usuários: ${(err as Error).message}`);
  }

  // Test 1.3: Autenticação (simular LoginScreen)
  logTest('1.3 - Simular autenticação do LoginScreen');
  totalTests++;
  try {
    const inputUser = 'joao.silva';
    const inputPass = 'senha123';

    const employees = await listEmployees();
    const user = employees.find((u) => u.username?.trim().toLowerCase() === inputUser);

    if (!user) throw new Error('Usuário não encontrado na busca');
    if (!user.ativo) throw new Error('Usuário está inativo');

    const storedPass = (user.password || '').trim();
    if (storedPass !== inputPass) throw new Error('Senha incorreta');

    logSuccess('Autenticação bem-sucedida');
    logInfo(`Usuário autenticado: ${user.nome} (${user.cargo})`);
    passedTests++;
  } catch (err) {
    logError(`Falha na autenticação: ${(err as Error).message}`);
  }

  // Test 1.4: Editar usuário
  logTest('1.4 - Editar usuário existente');
  totalTests++;
  try {
    const employees = await listEmployees();
    const user = employees.find((e) => e.username === 'joao.silva');
    if (!user) throw new Error('Usuário não encontrado');

    const updated = await upsertEmployee({
      ...user,
      telefone: '(62) 98765-4321',
      cargo: 'ATENDENTE',
    });

    if (updated.telefone !== '(62) 98765-4321') throw new Error('Telefone não atualizado');
    if (updated.cargo !== 'ATENDENTE') throw new Error('Cargo não atualizado');

    logSuccess('Usuário editado com sucesso');
    passedTests++;
  } catch (err) {
    logError(`Falha ao editar usuário: ${(err as Error).message}`);
  }

  // Test 1.5: Desativar usuário (soft delete)
  logTest('1.5 - Desativar usuário (soft delete)');
  totalTests++;
  try {
    const employees = await listEmployees();
    const user = employees.find((e) => e.username === 'joao.silva');
    if (!user) throw new Error('Usuário não encontrado');

    await upsertEmployee({ ...user, ativo: false });

    const reloaded = await listEmployees();
    const deactivated = reloaded.find((e) => e.id === user.id);

    if (!deactivated) throw new Error('Usuário não encontrado após desativação');
    if (deactivated.ativo !== false) throw new Error('Usuário não foi desativado');

    logSuccess('Usuário desativado com sucesso');
    passedTests++;
  } catch (err) {
    logError(`Falha ao desativar usuário: ${(err as Error).message}`);
  }

  // Test 1.6: Verificar unicidade de username
  logTest('1.6 - Validar unicidade de username');
  totalTests++;
  try {
    const duplicate: Colaborador = {
      id: generateId(),
      nome: 'Maria Santos',
      cargo: 'CAIXA',
      depositoId: 'DEP1',
      ativo: true,
      username: 'joao.silva', // Username duplicado
      password: 'senha456',
      permissoes: [],
    };

    const employees = await listEmployees();
    const exists = employees.some(
      (e) => e.id !== duplicate.id && e.username?.trim().toLowerCase() === duplicate.username?.trim().toLowerCase()
    );

    if (!exists) throw new Error('Validação de unicidade falhou - deveria detectar duplicata');

    logSuccess('Validação de username duplicado funcionando');
    passedTests++;
  } catch (err) {
    logError(`Falha na validação de unicidade: ${(err as Error).message}`);
  }

  // Test 1.7: Criar entregador global (sem depositoId)
  logTest('1.7 - Criar entregador (cargo global)');
  totalTests++;
  try {
    const driver: Colaborador = {
      id: generateId(),
      nome: 'Carlos Motorista',
      cargo: 'ENTREGADOR',
      depositoId: undefined as any, // Entregadores são globais
      ativo: true,
      username: 'carlos.driver',
      password: 'senha789',
      permissoes: [],
    };

    const created = await upsertEmployee(driver);

    if (created.cargo !== 'ENTREGADOR') throw new Error('Cargo incorreto');
    if (created.depositoId && created.depositoId !== '') {
      throw new Error('Entregador não deve ter depositoId fixo');
    }

    logSuccess('Entregador global criado com sucesso');
    passedTests++;
  } catch (err) {
    logError(`Falha ao criar entregador: ${(err as Error).message}`);
  }

  // Test 8: Criar GERENTE sem depositoId (acesso global)
  logTest('1.8 - Criar gerente global (sem depositoId)');
  totalTests++;
  try {
    const gerente: Colaborador = {
      id: generateId(),
      nome: 'Gerente Global',
      cargo: 'GERENTE',
      depositoId: undefined as any, // Gerentes têm acesso global
      ativo: true,
      username: 'gerente',
      password: 'admin123',
      permissoes: [],
    };

    const created = await upsertEmployee(gerente);

    if (created.cargo !== 'GERENTE') throw new Error('Cargo incorreto');
    
    // Simular login do gerente (deve funcionar sem depositoId)
    const employees = await listEmployees();
    const gerenteLogin = employees.find(u => u.username === 'gerente');
    
    if (!gerenteLogin) throw new Error('Gerente não encontrado');
    if (!gerenteLogin.ativo) throw new Error('Gerente inativo');
    if (gerenteLogin.password !== 'admin123') throw new Error('Senha incorreta');
    
    // ✅ GERENTE pode fazer login SEM depositoId
    logSuccess('Gerente global criado e pode fazer login');
    logInfo(`✅ GERENTE não precisa de depositoId (acesso global)`);
    passedTests++;
  } catch (err) {
    logError(`Falha ao criar gerente: ${(err as Error).message}`);
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
    log('\n🚀 Iniciando bateria de testes do sistema de LOGIN...', colors.blue + colors.bold);

    await clearTestData();

    const result = await testLoginSystem();

    if (!result.success) {
      process.exit(1);
    }

    log('\n✨ Bateria de testes concluída com sucesso!\n', colors.green + colors.bold);
    process.exit(0);
  } catch (err) {
    logError(`Erro fatal: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testLoginSystem, clearTestData };
