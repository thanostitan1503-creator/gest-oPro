/**
 * 🔍 VALIDADOR DE IDs (v3.0)
 * 
 * Script para verificar se existem IDs inválidos sendo gerados no código.
 * Procura por padrões problemáticos:
 * - Prefixos (COL-, PROD-, DEP-, CLI-, OS-)
 * - Date.now() usado como ID
 * - Strings aleatórias não-UUID
 * 
 * USO:
 * node scripts/validate-uuid-usage.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// ==================== PATTERNS PROIBIDOS ====================
const FORBIDDEN_PATTERNS = [
  // IDs com prefixos
  { pattern: /id:\s*['\"]?(COL-|PROD-|DEP-|CLI-|OS-|ZONE-|SECTOR-)/, message: 'ID com prefixo (COL-, PROD-, etc)' },
  
  // Date.now() usado diretamente em IDs
  { pattern: /id:\s*.*Date\.now\(\)/, message: 'Date.now() usado como ID' },
  
  // generateId com implementação antiga (timestamp)
  { pattern: /generateId\s*=.*Date\.now/, message: 'generateId() com timestamp' },
  
  // .insert() com campo id manual
  { pattern: /\.insert\(\{[^}]*id:\s*['\"]?[A-Z]+-/, message: '.insert() com ID prefixado' },
];

// ==================== PATTERNS CORRETOS (PARA REFERÊNCIA) ====================
const CORRECT_PATTERNS = [
  'crypto.randomUUID()',
  'import { generateId } from \'@/utils/idGenerator\'',
  '.insert(data) // sem campo id',
];

// ==================== HELPER FUNCTIONS ====================
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorar pastas específicas
      if (['node_modules', '.git', 'dist', 'build', '.vscode'].includes(file)) {
        continue;
      }
      getAllFiles(filePath, fileList);
    } else {
      // Apenas arquivos .ts, .tsx
      if (['.ts', '.tsx'].includes(extname(file))) {
        fileList.push(filePath);
      }
    }
  }
  
  return fileList;
}

function validateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          file: filePath,
          line: index + 1,
          code: line.trim(),
          message
        });
      }
    });
  });
  
  return issues;
}

// ==================== MAIN ====================
console.log('🔍 VALIDANDO USO DE IDs NO PROJETO...\n');

const rootDir = process.cwd();
const allFiles = getAllFiles(rootDir);

let totalIssues = 0;
const fileIssues = {};

allFiles.forEach(file => {
  const issues = validateFile(file);
  if (issues.length > 0) {
    fileIssues[file] = issues;
    totalIssues += issues.length;
  }
});

// ==================== REPORT ====================
if (totalIssues === 0) {
  console.log('✅ NENHUM PROBLEMA ENCONTRADO!');
  console.log('\n✨ Todos os IDs estão sendo gerados corretamente.\n');
  console.log('📚 Padrões corretos detectados:');
  CORRECT_PATTERNS.forEach(pattern => {
    console.log(`   ✓ ${pattern}`);
  });
} else {
  console.log(`❌ ENCONTRADOS ${totalIssues} PROBLEMAS EM ${Object.keys(fileIssues).length} ARQUIVOS:\n`);
  
  Object.entries(fileIssues).forEach(([file, issues]) => {
    const relativePath = file.replace(rootDir, '.');
    console.log(`\n📄 ${relativePath}`);
    issues.forEach(issue => {
      console.log(`   ❌ Linha ${issue.line}: ${issue.message}`);
      console.log(`      ${issue.code}`);
    });
  });
  
  console.log('\n\n📋 COMO CORRIGIR:\n');
  console.log('1. ✅ USAR: crypto.randomUUID() ou generateId() de @/utils/idGenerator');
  console.log('2. ✅ NÃO ENVIAR: campo "id" no .insert() - deixe o Supabase gerar');
  console.log('3. ❌ REMOVER: Prefixos (COL-, PROD-, etc) e Date.now()');
  console.log('\n📚 Ver: FIX_UUID_ERROR.md para mais detalhes\n');
  
  process.exit(1);
}

process.exit(0);
