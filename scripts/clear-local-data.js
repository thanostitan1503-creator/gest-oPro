/**
 * Script para limpar IndexedDB local (Dexie + storage.ts)
 * Execute no Console do Browser (F12 -> Console)
 */

// OPÇÃO 1: Reset Completo (Recomendado)
async function resetCompleto() {
  console.log('🧹 Limpando tudo...');
  
  // Limpa localStorage (sessão, theme, etc)
  localStorage.clear();
  console.log('✅ localStorage limpo');
  
  // Deleta o banco Dexie principal
  const { db } = await import('@/domain/db');
  await db.delete();
  console.log('✅ Dexie (GestaoProDexie) deletado');
  
  // Deleta o banco antigo storage.ts
  const storageDB = window.indexedDB.open('GestaoProDB');
  storageDB.onsuccess = (e) => {
    const db = e.target.result;
    db.close();
    const deleteReq = window.indexedDB.deleteDatabase('GestaoProDB');
    deleteReq.onsuccess = () => console.log('✅ Storage antigo (GestaoProDB) deletado');
  };
  
  console.log('🔄 Recarregando página...');
  setTimeout(() => location.reload(), 1000);
}

// OPÇÃO 2: Limpar só depósitos (Mais conservador)
async function limparApenasDepositos() {
  console.log('🧹 Limpando apenas depósitos...');
  
  const { db } = await import('@/domain/db');
  
  // Limpa tabelas relacionadas
  await db.deposits.clear();
  await db.employees.clear(); // Vai precisar recriar
  await db.outbox_events.where('entity').equals('deposits').delete();
  
  console.log('✅ Depósitos locais limpos');
  console.log('⚠️  Faça logout e login novamente');
}

// Execute no console:
// resetCompleto() ou limparApenasDepositos()
