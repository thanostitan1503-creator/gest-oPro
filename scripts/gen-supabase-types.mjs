#!/usr/bin/env node
import { execSync } from 'child_process';

const projectId = process.env.SUPABASE_PROJECT_ID || process.argv[2];
if (!projectId) {
  console.error('Uso: SUPABASE_PROJECT_ID=your_project_id node scripts/gen-supabase-types.mjs OR node scripts/gen-supabase-types.mjs <PROJECT_ID>');
  process.exit(1);
}

const cmd = `npx supabase gen types typescript --project-id ${projectId} --schema public`;
console.log('Executando:', cmd);
try {
  const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] });
  // Quando redirecionado para arquivo diretamente via Node, salvamos manualmente
} catch (err) {
  console.error('\nErro ao gerar tipos com supabase CLI. Certifique-se de que o supabase CLI está instalado (npx supabase) e de ter rede.');
  process.exit(2);
}

console.log('\nATENÇÃO: Para salvar a saída em src/types/supabase.ts rode:');
console.log('  npx supabase gen types typescript --project-id', projectId, '--schema public > src/types/supabase.ts');
console.log('\nOu use no PowerShell:');
console.log('  $env:SUPABASE_PROJECT_ID="' + projectId + '"; npx supabase gen types typescript --project-id $env:SUPABASE_PROJECT_ID --schema public > src/types/supabase.ts');
