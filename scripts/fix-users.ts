/**
 * Script para corrigir usuários sem depósito vinculado
 * Uso: npm run fix-users
 */

import Dexie from 'dexie';
import { Employee, Deposit } from '../src/domain/types';
import { db } from '../src/domain/db';

async function fixUsers() {
  console.log('=== CORREÇÃO DE USUÁRIOS SEM DEPÓSITO ===\n');
  
  // Buscar todos os usuários
  const users = await db.employees.toArray();
  const deposits = await db.deposits.toArray();
  
  if (deposits.length === 0) {
    console.log('❌ Nenhum depósito encontrado! Crie depósitos primeiro.');
    return;
  }
  
  console.log(`✅ Depósitos disponíveis:`);
  deposits.forEach((dep, i) => {
    console.log(`   ${i + 1}. ${dep.nome} (${dep.id})`);
  });
  console.log('');
  
  // Filtrar usuários com problema
  const problemUsers = users.filter(u => {
    const isGlobalRole = u.cargo === 'GERENTE' || u.cargo === 'ENTREGADOR';
    return !isGlobalRole && !u.depositoId;
  });
  
  if (problemUsers.length === 0) {
    console.log('✅ Nenhum usuário precisa de correção!');
    return;
  }
  
  console.log(`⚠️ Usuários que precisam de depósito: ${problemUsers.length}\n`);
  
  // Usar primeiro depósito como padrão
  const defaultDepositId = deposits[0].id;
  const defaultDepositName = deposits[0].nome;
  
  console.log(`📍 Usando depósito padrão: ${defaultDepositName}\n`);
  
  // Corrigir cada usuário
  for (const user of problemUsers) {
    console.log(`🔧 Corrigindo: ${user.nome} (${user.cargo})`);
    
    await db.employees.update(user.id, {
      depositoId: defaultDepositId
    });
    
    console.log(`   ✅ Depósito vinculado: ${defaultDepositName}\n`);
  }
  
  console.log('✅ Correção concluída com sucesso!');
  console.log('\n💡 Recarregue a página e tente fazer login novamente.');
}

fixUsers().catch(console.error);
