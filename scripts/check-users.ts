/**
 * Script para verificar dados dos usuários no IndexedDB do navegador
 * Como acessar: Abrir console do navegador (F12) e colar este código
 */

import Dexie from 'dexie';
import { Employee } from '../src/domain/types';

// Definir schema Dexie igual ao do sistema
class GasDB extends Dexie {
  employees!: Dexie.Table<Employee, string>;

  constructor() {
    super('GasDistribution');
    this.version(15).stores({
      employees: 'id, nome, cpf, cargo, ativo, depositoId',
    });
  }
}

async function checkUsers() {
  const db = new GasDB();
  
  console.log('=== VERIFICAÇÃO DE USUÁRIOS ===\n');
  
  const users = await db.employees.toArray();
  
  if (users.length === 0) {
    console.log('❌ Nenhum usuário encontrado no banco');
    return;
  }
  
  console.log(`✅ Total de usuários: ${users.length}\n`);
  
  users.forEach((user, index) => {
    console.log(`👤 Usuário ${index + 1}:`);
    console.log(`   Nome: ${user.nome}`);
    console.log(`   CPF: ${user.cpf}`);
    console.log(`   Cargo: ${user.cargo}`);
    console.log(`   Depósito: ${user.depositoId || '❌ SEM DEPÓSITO'}`);
    console.log(`   Ativo: ${user.ativo ? '✅ Sim' : '❌ Não'}`);
    
    // Validar regras de negócio
    const isGlobalRole = user.cargo === 'GERENTE' || user.cargo === 'ENTREGADOR';
    const needsDeposit = !isGlobalRole && !user.depositoId;
    
    if (needsDeposit) {
      console.log(`   ⚠️ PROBLEMA: ${user.cargo} precisa de depósito vinculado!`);
    }
    
    console.log('');
  });
  
  // Resumo de problemas
  const problemUsers = users.filter(u => {
    const isGlobalRole = u.cargo === 'GERENTE' || u.cargo === 'ENTREGADOR';
    return !isGlobalRole && !u.depositoId;
  });
  
  if (problemUsers.length > 0) {
    console.log('⚠️ USUÁRIOS COM PROBLEMA:');
    problemUsers.forEach(u => {
      console.log(`   - ${u.nome} (${u.cargo}) - SEM DEPÓSITO`);
    });
  } else {
    console.log('✅ Todos os usuários estão corretos!');
  }
}

checkUsers().catch(console.error);
