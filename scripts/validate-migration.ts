/**
 * 🔍 SCRIPT DE VALIDAÇÃO DA MIGRAÇÃO
 * 
 * Este script verifica se os componentes estão usando os serviços corretamente.
 * 
 * Como usar:
 * ```bash
 * npx tsx scripts/validate-migration.ts
 * ```
 */

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  file: string;
  issues: string[];
  warnings: string[];
}

const results: ValidationResult[] = [];

/**
 * Procura por padrões problemáticos em arquivos
 */
function validateFile(filePath: string): ValidationResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. Verifica uso direto do Supabase (proibido em components/)
  if (filePath.includes('/components/') || filePath.includes('\\components\\')) {
    if (content.includes('supabase.from(')) {
      issues.push('❌ Uso direto de supabase.from() detectado (use serviços)');
    }

    if (content.includes("import { createClient } from '@supabase/supabase-js'")) {
      issues.push('❌ Import direto do Supabase detectado (use @/services)');
    }

    // 2. Verifica se está importando serviços (esperado)
    if (!content.includes("from '@/services'") && !content.includes('from "../services"')) {
      if (content.includes('async function') || content.includes('async ')) {
        warnings.push('⚠️ Arquivo com funções async mas não importa serviços');
      }
    }
  }

  // 3. Verifica uso de 'any' excessivo
  const anyMatches = content.match(/:\s*any/g);
  if (anyMatches && anyMatches.length > 5) {
    warnings.push(`⚠️ Uso excessivo de 'any' (${anyMatches.length} ocorrências)`);
  }

  // 4. Verifica tratamento de erros
  if (content.includes('await ') && !content.includes('try {')) {
    if (!content.includes('.catch(')) {
      warnings.push('⚠️ Chamadas async sem try/catch ou .catch()');
    }
  }

  // 5. Verifica campos em português (devem estar em inglês)
  const portugueseFields = [
    'nome:', 'endereco:', 'telefone:', 'ativo:', 'preco_venda:', 'preco_custo:',
    'quantidade:', 'depositoId:', 'produtoId:', 'clienteId:'
  ];

  portugueseFields.forEach(field => {
    if (content.includes(field)) {
      warnings.push(`⚠️ Campo em português detectado: ${field.replace(':', '')}`);
    }
  });

  return { file: path.basename(filePath), issues, warnings };
}

/**
 * Escaneia diretório recursivamente
 */
function scanDirectory(dir: string, extensions: string[] = ['.tsx', '.ts']): string[] {
  const files: string[] = [];

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Ignora node_modules, dist, .git
        if (!['node_modules', 'dist', '.git', 'build'].includes(entry.name)) {
          scan(fullPath);
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

/**
 * Gera relatório
 */
function generateReport() {
  console.log('\n🔍 RELATÓRIO DE VALIDAÇÃO DA MIGRAÇÃO\n');
  console.log('='.repeat(60));

  let totalIssues = 0;
  let totalWarnings = 0;
  let filesWithProblems = 0;

  for (const result of results) {
    if (result.issues.length > 0 || result.warnings.length > 0) {
      filesWithProblems++;
      console.log(`\n📁 ${result.file}`);

      if (result.issues.length > 0) {
        result.issues.forEach(issue => console.log(`  ${issue}`));
        totalIssues += result.issues.length;
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => console.log(`  ${warning}`));
        totalWarnings += result.warnings.length;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMO:\n');
  console.log(`  Arquivos analisados: ${results.length}`);
  console.log(`  Arquivos com problemas: ${filesWithProblems}`);
  console.log(`  Issues críticos: ${totalIssues} ❌`);
  console.log(`  Warnings: ${totalWarnings} ⚠️`);

  if (totalIssues === 0 && totalWarnings === 0) {
    console.log('\n✅ Nenhum problema detectado! Migração parece estar correta.\n');
  } else if (totalIssues === 0) {
    console.log('\n✅ Nenhum issue crítico! Apenas warnings (opcional corrigir).\n');
  } else {
    console.log('\n❌ Issues críticos detectados! Corrija antes de prosseguir.\n');
  }
}

/**
 * Verifica estrutura de serviços
 */
function checkServiceStructure() {
  console.log('\n🏗️ VERIFICANDO ESTRUTURA DE SERVIÇOS...\n');

  const servicesDir = path.join(process.cwd(), 'src', 'services');
  const expectedServices = [
    'depositService.ts',
    'productService.ts',
    'stockService.ts',
    'serviceOrderService.ts',
    'clientService.ts',
    'financialService.ts',
    'deliveryService.ts',
    'index.ts'
  ];

  const missing: string[] = [];

  for (const service of expectedServices) {
    const servicePath = path.join(servicesDir, service);
    if (!fs.existsSync(servicePath)) {
      missing.push(service);
    }
  }

  if (missing.length === 0) {
    console.log('✅ Todos os serviços estão presentes!\n');
  } else {
    console.log('❌ Serviços faltando:');
    missing.forEach(s => console.log(`  - ${s}`));
    console.log('');
  }
}

/**
 * Main
 */
function main() {
  console.log('🚀 Iniciando validação da migração...\n');

  // 1. Verifica estrutura de serviços
  checkServiceStructure();

  // 2. Escaneia componentes
  const componentsDir = path.join(process.cwd(), 'components');
  if (fs.existsSync(componentsDir)) {
    console.log('📂 Escaneando components/...\n');
    const files = scanDirectory(componentsDir);
    console.log(`Encontrados ${files.length} arquivos.\n`);

    for (const file of files) {
      const result = validateFile(file);
      results.push(result);
    }
  }

  // 3. Escaneia src/components
  const srcComponentsDir = path.join(process.cwd(), 'src', 'components');
  if (fs.existsSync(srcComponentsDir)) {
    console.log('📂 Escaneando src/components/...\n');
    const files = scanDirectory(srcComponentsDir);
    console.log(`Encontrados ${files.length} arquivos.\n`);

    for (const file of files) {
      const result = validateFile(file);
      results.push(result);
    }
  }

  // 4. Gera relatório
  generateReport();
}

main();
