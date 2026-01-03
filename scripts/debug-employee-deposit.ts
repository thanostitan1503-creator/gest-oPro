import { db } from '../src/domain/db';

async function debug() {
  console.log('🔍 === DIAGNÓSTICO COLABORADOR-DEPÓSITO ===\n');

  // 1. Listar todos os depósitos
  const deposits = await db.deposits.toArray();
  console.log('📦 DEPÓSITOS NO BANCO:');
  deposits.forEach(d => {
    console.log(`  ✓ ID: "${d.id}" | Nome: "${d.nome}" | Tipo: ${typeof d.id}`);
  });

  // 2. Listar todos os colaboradores
  const employees = await db.employees.toArray();
  console.log('\n👥 COLABORADORES NO BANCO:');
  employees.forEach(e => {
    const depositMatch = deposits.find(d => d.id === e.depositoId);
    console.log(`  - Nome: "${e.nome}" | Cargo: ${e.cargo}`);
    console.log(`    depositoId: "${e.depositoId}" (${typeof e.depositoId})`);
    console.log(`    Depósito encontrado: ${depositMatch ? `✓ "${depositMatch.nome}"` : '❌ NÃO'}`);
  });

  // 3. Verificar Maria especificamente
  console.log('\n🔎 MARIA EM DETALHES:');
  const maria = employees.find(e => e.nome.toLowerCase() === 'maria');
  if (maria) {
    console.log(JSON.stringify(maria, null, 2));
    
    // Verificar match exato
    const mariaDeposit = deposits.find(d => d.id === maria.depositoId);
    console.log(`\n  depositoId de Maria: "${maria.depositoId}"`);
    console.log(`  Depósito correspondente: ${mariaDeposit ? `✓ "${mariaDeposit.nome}"` : '❌ NÃO ENCONTRADO'}`);
    
    if (!mariaDeposit && maria.depositoId) {
      console.log('\n⚠️ PROBLEMA DETECTADO:');
      console.log(`  Maria tem depositoId="${maria.depositoId}" mas não existe depósito com esse ID!`);
      console.log('  Possíveis causas:');
      console.log('    1. Depósito foi deletado');
      console.log('    2. IDs não batem por espaços/caracteres invisíveis');
      console.log('    3. Campo não foi sincronizado corretamente');
    }
  } else {
    console.log('  Maria não encontrada no banco!');
  }

  // 4. Verificar IDs inválidos
  console.log('\n⚠️ COLABORADORES COM DEPÓSITO INVÁLIDO:');
  const invalid = employees.filter(e => {
    const isGlobal = e.cargo === 'GERENTE' || e.cargo === 'ENTREGADOR';
    if (isGlobal) return false; // OK não ter depósito
    if (!e.depositoId) return true; // Falta depósito
    return !deposits.find(d => d.id === e.depositoId); // Depósito não existe
  });
  
  if (invalid.length === 0) {
    console.log('  ✓ Todos os colaboradores estão OK!');
  } else {
    invalid.forEach(e => {
      console.log(`  ❌ ${e.nome} (${e.cargo}): depositoId="${e.depositoId}"`);
    });
  }

  process.exit(0);
}

debug().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
