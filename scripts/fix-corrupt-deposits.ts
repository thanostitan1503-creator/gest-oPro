/**
 * Script para corrigir nomes corrompidos de depósitos
 * 
 * PROBLEMA: Depósitos foram salvos com `name: id` ao invés de `name: nome`
 * CAUSA: Uso de storage.ts (antigo) ao invés de repositories (novo)
 * 
 * Execute este script para limpar dados corrompidos no Supabase
 */

import { supabase } from '../src/domain/supabaseClient';

async function fixCorruptDeposits() {
  console.log('🔍 Buscando depósitos com nomes corrompidos...');
  
  const { data: deposits, error } = await supabase
    .from('deposits')
    .select('*');
  
  if (error) {
    console.error('❌ Erro ao buscar depósitos:', error);
    return;
  }
  
  if (!deposits || deposits.length === 0) {
    console.log('✅ Nenhum depósito encontrado.');
    return;
  }
  
  console.log(`📊 Encontrados ${deposits.length} depósitos`);
  
  const corrupted = deposits.filter(d => {
    const name = String(d.name || '');
    // Detecta IDs no campo nome (UUIDs ou padrão DEP1, DEP2, etc)
    return name.match(/^[a-f0-9]{8}-[a-f0-9]{4}-/i) || name.match(/^DEP\d+$/);
  });
  
  if (corrupted.length === 0) {
    console.log('✅ Nenhum depósito corrompido detectado!');
    return;
  }
  
  console.log(`⚠️  Detectados ${corrupted.length} depósitos com nomes corrompidos:`);
  corrupted.forEach(d => {
    console.log(`  - ID: ${d.id}, Name: ${d.name}`);
  });
  
  console.log('\n🛠️  AÇÃO NECESSÁRIA:');
  console.log('Execute no Supabase SQL Editor:');
  console.log('\n```sql');
  
  corrupted.forEach((d, i) => {
    const suggestedName = `Depósito ${i + 1}`;
    console.log(`UPDATE deposits SET name = '${suggestedName}' WHERE id = '${d.id}';`);
  });
  
  console.log('```\n');
  console.log('Após executar, faça um sync no frontend para atualizar o Dexie.');
}

fixCorruptDeposits().catch(console.error);
