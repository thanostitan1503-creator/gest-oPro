/**
 * 🔍 VALIDADOR DA LEI MAGNA - Gas Distribution ERP
 * 
 * Script de validação que verifica se o código está em conformidade
 * com os padrões estabelecidos na LEI_MAGNA_DADOS.md
 * 
 * Uso: node scripts/validate-lei-magna.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 🎯 Padrões Proibidos (campos legados que NÃO devem existir no código)
const FORBIDDEN_PATTERNS = [
  // Deposit variations
  { pattern: /\.name(?!\w)/g, entity: 'Deposit', correct: '.nome', severity: 'ERROR' },
  { pattern: /\.address(?!\w)/g, entity: 'Deposit', correct: '.endereco', severity: 'ERROR' },
  { pattern: /\.active(?!\w)/g, entity: 'Multiple', correct: '.ativo', severity: 'WARNING' },
  { pattern: /\.color(?!\w)/g, entity: 'Deposit', correct: '.cor', severity: 'ERROR' },
  
  // depositoId variations
  { pattern: /\.deposit_id(?!\w)/g, entity: 'Multiple', correct: '.depositoId', severity: 'ERROR' },
  { pattern: /\.deposito_id(?!\w)/g, entity: 'Multiple', correct: '.depositoId', severity: 'ERROR' },
  
  // Colaborador variations
  { pattern: /\.role(?!\w)/g, entity: 'Colaborador', correct: '.cargo', severity: 'WARNING' },
  
  // Client variations (em alguns lugares ainda pode existir, mas verificar)
  { pattern: /\.phone(?!\w)/g, entity: 'Cliente', correct: '.telefone', severity: 'WARNING' },
];

// 📁 Arquivos a serem validados
const FILES_TO_VALIDATE = [
  'components/DepositsModule.tsx',
  'components/ProductsModule.tsx',
  'components/EmployeesModule.tsx',
  'components/ClientsModule.tsx',
  'components/NewServiceOrder.tsx',
  'components/FinancialModule.tsx',
  'domain/repositories/deposits.repo.ts',
  'domain/repositories/employees.repo.ts',
  'domain/repositories/products.repo.ts',
  'domain/types.ts',
];

// 🔍 Função de Validação
function validateFile(filePath) {
  const fullPath = join(rootDir, filePath);
  let content;
  
  try {
    content = readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.warn(`⚠️  Arquivo não encontrado: ${filePath}`);
    return { errors: 0, warnings: 0 };
  }
  
  const lines = content.split('\n');
  let errorCount = 0;
  let warningCount = 0;
  
  console.log(`\n📄 Validando: ${filePath}`);
  
  FORBIDDEN_PATTERNS.forEach(({ pattern, entity, correct, severity }) => {
    const matches = content.match(pattern);
    
    if (matches && matches.length > 0) {
      // Encontrar linha específica
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          const lineNum = index + 1;
          
          // ✅ SKIP: Defensive fallbacks (ex: .nome ?? .name)
          if (line.includes('??') && (line.includes('.nome') || line.includes('.depositoId'))) {
            return;
          }
          
          // ✅ SKIP: Local item objects (ex: item.color, tab.color)
          if ((line.includes('item.color') || line.includes('tab.color')) && !line.includes('zone.color')) {
            return;
          }
          
          // ✅ SKIP: Database column names in queries (ex: b.deposit_id from stock_balance)
          if (line.includes('.deposit_id') && line.includes('b.deposit_id')) {
            return;
          }
          
          const icon = severity === 'ERROR' ? '❌' : '⚠️';
          
          console.log(`  ${icon} Linha ${lineNum}: ${line.trim()}`);
          console.log(`     Entidade: ${entity} | Use: ${correct}`);
          
          if (severity === 'ERROR') errorCount++;
          else warningCount++;
        }
      });
    }
  });
  
  if (errorCount === 0 && warningCount === 0) {
    console.log('  ✅ Arquivo em conformidade!');
  }
  
  return { errors: errorCount, warnings: warningCount };
}

// 🏁 Executar Validação
function main() {
  console.log('🏛️  VALIDADOR DA LEI MAGNA DOS DADOS\n');
  console.log('📋 Verificando conformidade com padrões de nomenclatura...\n');
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  FILES_TO_VALIDATE.forEach(file => {
    const { errors, warnings } = validateFile(file);
    totalErrors += errors;
    totalWarnings += warnings;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA VALIDAÇÃO\n');
  console.log(`❌ Erros Críticos: ${totalErrors}`);
  console.log(`⚠️  Avisos: ${totalWarnings}`);
  
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n✅ SISTEMA EM CONFORMIDADE COM A LEI MAGNA!');
    process.exit(0);
  } else {
    console.log('\n🚨 AÇÃO NECESSÁRIA:');
    if (totalErrors > 0) {
      console.log('   - Corrigir ERROS críticos antes de fazer commit');
    }
    if (totalWarnings > 0) {
      console.log('   - Revisar AVISOS (podem indicar código legado)');
    }
    console.log('\n📖 Consulte: LEI_MAGNA_DADOS.md para padrões corretos');
    process.exit(totalErrors > 0 ? 1 : 0);
  }
}

main();
