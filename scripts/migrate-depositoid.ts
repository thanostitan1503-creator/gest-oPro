/**
 * 🔧 MIGRAÇÃO: Normalizar campos depositoId
 * 
 * PROBLEMA: Colaboradores têm 3 campos diferentes:
 * - deposit_id (snake_case inglês) 
 * - depositoId (camelCase português)
 * - deposito_id (snake_case português) ← onde está o valor real
 * 
 * SOLUÇÃO: Unificar tudo em depositoId (camelCase)
 */

import { db } from '../domain/db';

async function migrateDepositIds() {
  console.log('🔧 === MIGRAÇÃO: Normalizar depositoId ===\n');

  const employees = await db.employees.toArray();
  console.log(`📊 Total de colaboradores: ${employees.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const emp of employees) {
    const currentDepositId = emp.depositoId;
    const depositoIdSnake = (emp as any).deposito_id;
    const depositIdSnake = (emp as any).deposit_id;

    // Se depositoId (camelCase) já está preenchido, pula
    if (currentDepositId) {
      skipped++;
      continue;
    }

    // Se tem valor em deposito_id ou deposit_id, migra
    const newDepositId = depositoIdSnake ?? depositIdSnake ?? null;

    if (newDepositId) {
      console.log(`✅ Corrigindo ${emp.nome} (${emp.cargo}): null → "${newDepositId}"`);
      
      await db.employees.update(emp.id, {
        depositoId: newDepositId
      });
      
      fixed++;
    } else {
      // Se não tem nenhum valor, verifica se deveria ter
      const isGlobal = emp.cargo === 'GERENTE' || emp.cargo === 'ENTREGADOR';
      if (!isGlobal) {
        console.warn(`⚠️ ${emp.nome} (${emp.cargo}) não tem depositoId em NENHUM campo!`);
      }
      skipped++;
    }
  }

  console.log('\n📊 RESUMO:');
  console.log(`  ✅ Corrigidos: ${fixed}`);
  console.log(`  ⏭️  Ignorados: ${skipped}`);
  console.log(`  📦 Total: ${employees.length}`);

  if (fixed > 0) {
    console.log('\n✨ Migração concluída! Recarregue a página (F5) para ver as mudanças.');
  } else {
    console.log('\n✅ Nenhuma correção necessária!');
  }

  process.exit(0);
}

migrateDepositIds().catch(err => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});
