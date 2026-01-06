/**
 * Script de Limpeza: Remover Dados Órfãos de Estoque
 * 
 * Executa no Console do Navegador (F12)
 * Remove registros de stock_balance, stock_movements, zone_pricing
 * e product_exchange_rules que apontam para produtos que não existem mais.
 */

import { db } from '@/domain/db';

async function cleanOrphanedStock() {
  console.log('🧹 Iniciando limpeza de dados órfãos...\n');

  try {
    // 1. Buscar todos os IDs de produtos existentes
    const products = await db.products.toArray();
    const validProductIds = new Set(products.map(p => p.id));
    console.log(`✅ ${validProductIds.size} produtos encontrados no banco\n`);

    // 2. Limpar stock_balance
    const allStockBalances = await db.stock_balance.toArray();
    const orphanedBalances = allStockBalances.filter(sb => !validProductIds.has(sb.product_id));
    
    if (orphanedBalances.length > 0) {
      console.log(`⚠️  Encontrados ${orphanedBalances.length} registros órfãos em stock_balance:`);
      console.table(orphanedBalances.map(sb => ({
        product_id: sb.product_id.substring(0, 8),
        deposit_id: sb.deposit_id?.substring(0, 8) || 'null',
        quantidade: sb.quantidade_atual
      })));
      
      for (const sb of orphanedBalances) {
        await db.stock_balance.delete([sb.product_id, sb.deposit_id]);
      }
      console.log(`✅ ${orphanedBalances.length} registros removidos de stock_balance\n`);
    } else {
      console.log('✅ Nenhum registro órfão em stock_balance\n');
    }

    // 3. Limpar stock_movements
    const allMovements = await db.stock_movements.toArray();
    const orphanedMovements = allMovements.filter(sm => !validProductIds.has(sm.produtoId));
    
    if (orphanedMovements.length > 0) {
      console.log(`⚠️  Encontrados ${orphanedMovements.length} movimentos órfãos em stock_movements`);
      
      for (const sm of orphanedMovements) {
        await db.stock_movements.delete(sm.id);
      }
      console.log(`✅ ${orphanedMovements.length} movimentos removidos\n`);
    } else {
      console.log('✅ Nenhum movimento órfão em stock_movements\n');
    }

    // 4. Limpar zone_pricing
    const allPricing = await db.zone_pricing.toArray();
    const orphanedPricing = allPricing.filter(pp => !validProductIds.has(pp.productId));
    
    if (orphanedPricing.length > 0) {
      console.log(`⚠️  Encontrados ${orphanedPricing.length} preços órfãos em zone_pricing`);
      
      for (const pp of orphanedPricing) {
        await db.zone_pricing.delete(pp.id);
      }
      console.log(`✅ ${orphanedPricing.length} preços removidos\n`);
    } else {
      console.log('✅ Nenhum preço órfão em zone_pricing\n');
    }

    // 5. Limpar product_exchange_rules
    const allRules = await db.product_exchange_rules.toArray();
    const orphanedRules = allRules.filter(
      r => !validProductIds.has(r.productId) || !validProductIds.has(r.returnProductId)
    );
    
    if (orphanedRules.length > 0) {
      console.log(`⚠️  Encontradas ${orphanedRules.length} regras órfãs em product_exchange_rules`);
      
      for (const r of orphanedRules) {
        await db.product_exchange_rules.delete(r.id);
      }
      console.log(`✅ ${orphanedRules.length} regras removidas\n`);
    } else {
      console.log('✅ Nenhuma regra órfã em product_exchange_rules\n');
    }

    // 6. Resumo final
    const totalCleaned = orphanedBalances.length + orphanedMovements.length + orphanedPricing.length + orphanedRules.length;
    
    console.log('═══════════════════════════════════════');
    console.log(`🎉 LIMPEZA CONCLUÍDA!`);
    console.log(`📊 ${totalCleaned} registros órfãos removidos`);
    console.log('═══════════════════════════════════════\n');

    // Verificação pós-limpeza
    const remainingBalances = await db.stock_balance.toArray();
    const remainingMovements = await db.stock_movements.toArray();
    const remainingPricing = await db.zone_pricing.toArray();
    const remainingRules = await db.product_exchange_rules.toArray();

    console.log('📈 Estado após limpeza:');
    console.log(`   Produtos: ${products.length}`);
    console.log(`   Stock Balance: ${remainingBalances.length}`);
    console.log(`   Stock Movements: ${remainingMovements.length}`);
    console.log(`   Product Pricing: ${remainingPricing.length}`);
    console.log(`   Exchange Rules: ${remainingRules.length}\n`);

  } catch (error) {
    console.error('❌ Erro durante limpeza:', error);
  }
}

// Executar limpeza
cleanOrphanedStock();
