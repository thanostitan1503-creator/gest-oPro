/**
 * 🔑 GERENCIADOR DE USUÁRIOS E SENHAS
 * 
 * Script para visualizar e resetar senhas em ambiente de desenvolvimento
 * 
 * Uso:
 *   npm run users:list          - Listar todos os usuários com senhas
 *   npm run users:reset <user>  - Resetar senha de um usuário
 *   npm run users:clear         - Limpar todos os usuários
 */

import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

// Configurar fake-indexeddb
(globalThis as any).indexedDB = (global as any).indexedDB;
(globalThis as any).IDBKeyRange = (global as any).IDBKeyRange;
Dexie.dependencies.indexedDB = (global as any).indexedDB;
Dexie.dependencies.IDBKeyRange = (global as any).IDBKeyRange;

import { db } from '../domain/db';
import { listEmployees, upsertEmployee } from '../domain/repositories/employees.repo';
import type { Colaborador } from '../domain/types';

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

async function listUsers() {
  log('\n' + '='.repeat(80), colors.cyan + colors.bold);
  log('👥 USUÁRIOS CADASTRADOS NO SISTEMA', colors.cyan + colors.bold);
  log('='.repeat(80) + '\n', colors.cyan + colors.bold);

  const employees = await listEmployees();

  if (employees.length === 0) {
    log('⚠️  Nenhum usuário cadastrado no sistema.', colors.yellow);
    log('   Use a tela de login para criar o primeiro administrador.\n');
    return;
  }

  log(`📊 Total de usuários: ${employees.length}\n`, colors.bold);

  employees.forEach((user, idx) => {
    const icon = user.ativo ? '✅' : '❌';
    const cargoColor = user.cargo === 'GERENTE' ? colors.green : user.cargo === 'ENTREGADOR' ? colors.blue : colors.reset;
    
    log(`${icon} [${idx + 1}] ${user.nome}`, colors.bold);
    log(`    Username: ${user.username}`, colors.cyan);
    log(`    Senha: ${user.password || '(não definida)'}`, colors.yellow);
    log(`    Cargo: ${user.cargo}`, cargoColor);
    log(`    Depósito: ${user.depositoId || '(global)'}`, colors.reset);
    log(`    Status: ${user.ativo ? 'ATIVO' : 'INATIVO'}`, user.ativo ? colors.green : colors.red);
    log('');
  });

  log('='.repeat(80) + '\n', colors.cyan);
}

async function resetPassword(username: string, newPassword: string) {
  log('\n🔑 Resetando senha...', colors.yellow);

  const employees = await listEmployees();
  const user = employees.find(u => u.username?.toLowerCase() === username.toLowerCase());

  if (!user) {
    log(`❌ Usuário "${username}" não encontrado!`, colors.red);
    log('   Use: npm run users:list para ver todos os usuários\n');
    return;
  }

  const updated: Colaborador = {
    ...user,
    password: newPassword,
  };

  await upsertEmployee(updated);

  log(`✅ Senha do usuário "${user.nome}" alterada com sucesso!`, colors.green);
  log(`   Username: ${user.username}`, colors.cyan);
  log(`   Nova senha: ${newPassword}\n`, colors.yellow);
}

async function clearAllUsers() {
  log('\n⚠️  ATENÇÃO: Esta ação irá apagar TODOS os usuários!', colors.red + colors.bold);
  log('   Pressione Ctrl+C para cancelar ou aguarde 3 segundos...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  await db.employees.clear();
  await db.outbox_events.clear();

  log('✅ Todos os usuários foram removidos.', colors.green);
  log('   Na próxima vez que acessar o sistema, será solicitado criar o primeiro administrador.\n');
}

async function main() {
  try {
    await db.open();

    const command = process.argv[2];
    const arg1 = process.argv[3];
    const arg2 = process.argv[4];

    switch (command) {
      case 'list':
        await listUsers();
        break;

      case 'reset':
        if (!arg1 || !arg2) {
          log('❌ Uso: npm run users:reset <username> <nova-senha>', colors.red);
          log('   Exemplo: npm run users:reset admin 1234\n');
          process.exit(1);
        }
        await resetPassword(arg1, arg2);
        break;

      case 'clear':
        await clearAllUsers();
        break;

      default:
        log('\n📖 USO DO SCRIPT:', colors.cyan + colors.bold);
        log('   npm run users:list                      - Listar usuários e senhas');
        log('   npm run users:reset <user> <senha>      - Resetar senha de usuário');
        log('   npm run users:clear                     - Limpar todos os usuários\n');
        log('Exemplos:', colors.yellow);
        log('   npm run users:list');
        log('   npm run users:reset admin novaSenha123');
        log('   npm run users:clear\n');
    }

    process.exit(0);
  } catch (err) {
    log(`\n❌ Erro: ${(err as Error).message}`, colors.red);
    process.exit(1);
  }
}

main();
