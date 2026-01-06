# Scripts de Manutenção

## Ordem de Execução Recomendada

### 1. Verificar e Sincronizar Depósitos
```bash
npx tsx scripts/check-and-sync-deposits.ts
```

**O que faz:**
- Verifica se todos os depósitos locais (Dexie) existem no Supabase
- Enfileira depósitos faltantes para sincronização
- Mostra um relatório do que está faltando

### 2. Corrigir Ordem de Sincronização
```bash
npx tsx scripts/fix-sync-order.ts
```

**O que faz:**
- Marca eventos com erro (`FAILED`) como `PENDING` novamente
- Remove a flag de erro para permitir nova tentativa
- A nova ordem de priorização vai sincronizar corretamente

### 3. Forçar Sincronização
No console do navegador (F12):
```javascript
// Ver eventos pendentes
const events = await db.outbox_events.where('status').equals('PENDING').toArray();
console.log('Eventos pendentes:', events);

// Forçar sincronização
await window.__syncNow?.({ log: true });
```

---

## Outros Scripts Disponíveis

### Limpar Dados Locais
```bash
npx tsx scripts/clear-local-data.js
```
⚠️ **ATENÇÃO:** Apaga TODOS os dados do IndexedDB local

### Debugar Estoque
```bash
npx tsx scripts/debug-stock.js
```
Mostra o estado atual do estoque por depósito

### Validar Migração
```bash
npx tsx scripts/validate-fix.js
```
Valida se a estrutura do banco está correta

---

## Troubleshooting

### Erro: "deposit_id not present in table deposits"
**Causa:** Stock movements foram sincronizados antes dos deposits  
**Solução:** Execute os scripts 1 e 2 acima

### Erro: "Column 'reason' does not exist"
**Causa:** Migração SQL não foi executada no Supabase  
**Solução:** Execute `supabase/migrations/2025_01_05_safe_migration.sql`

### Sincronização travada
**Causa:** Muitos eventos com erro bloqueando a fila  
**Solução:** Execute `fix-sync-order.ts` para resetar
