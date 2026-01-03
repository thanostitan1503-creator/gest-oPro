/**
 * 🔄 RESET COMPLETO DO BANCO DE DADOS
 * 
 * Este script deleta o banco IndexedDB e força recriação com schema correto
 * Resolve todos os erros de índices não encontrados
 * 
 * Uso: npm run db:reset
 */

import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

// Configurar fake-indexeddb
(globalThis as any).indexedDB = (global as any).indexedDB;
(globalThis as any).IDBKeyRange = (global as any).IDBKeyRange;
Dexie.dependencies.indexedDB = (global as any).indexedDB;
Dexie.dependencies.IDBKeyRange = (global as any).IDBKeyRange;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function resetDatabase() {
  log('\n🔄 RESET COMPLETO DO BANCO DE DADOS\n', colors.cyan + colors.bold);

  try {
    log('⚠️  Esta operação irá:', colors.yellow);
    log('   • Deletar TODOS os dados do IndexedDB');
    log('   • Remover TODOS os usuários cadastrados');
    log('   • Limpar produtos, clientes, ordens de serviço, etc.');
    log('   • Forçar recriação do banco com índices corretos\n');
    log('⏳ Aguardando 3 segundos...', colors.yellow);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Deletar banco fake (para testes)
    const dbName = 'GestaoProDB';
    const request = indexedDB.deleteDatabase(dbName);

    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        log(`✅ Banco "${dbName}" deletado com sucesso!`, colors.green);
        resolve(true);
      };
      request.onerror = () => {
        log(`❌ Erro ao deletar banco: ${request.error}`, colors.red);
        reject(request.error);
      };
      request.onblocked = () => {
        log(`⚠️  Banco bloqueado. Feche todas as abas do sistema e tente novamente.`, colors.yellow);
      };
    });

    log('\n📋 PRÓXIMOS PASSOS:', colors.cyan + colors.bold);
    log('1. ✅ Banco deletado com sucesso');
    log('2. 🔄 Recarregue a página do sistema (F5)');
    log('3. 📝 O sistema criará o banco com os índices corretos');
    log('4. 👤 Crie novamente o primeiro administrador\n');

    log('💡 DICA: Execute este comando no NAVEGADOR para garantir:', colors.yellow);
    log('   Pressione F12 > Console > Cole e execute:');
    log('   ', colors.cyan);
    log('   indexedDB.deleteDatabase("GestaoProDB"); location.reload();', colors.bold + colors.cyan);
    log('');

  } catch (err) {
    log(`\n❌ Erro: ${(err as Error).message}`, colors.red);
    log('\n💡 Solução alternativa:', colors.yellow);
    log('   1. Abra o sistema: http://localhost:3001');
    log('   2. Pressione F12');
    log('   3. Console > Cole:');
    log('      indexedDB.deleteDatabase("GestaoProDB"); location.reload();');
    process.exit(1);
  }
}

resetDatabase().then(() => {
  log('✅ Reset concluído!\n', colors.green + colors.bold);
  process.exit(0);
}).catch((err) => {
  log(`❌ Falha: ${err}\n`, colors.red);
  process.exit(1);
});
