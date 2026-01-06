# 🤖 SCRIPT DE MIGRAÇÃO AUTOMÁTICA v3.0

## 🎯 OBJETIVO

Este script substitui automaticamente todos os imports de Dexie por seus equivalentes v3.0.

---

## 📋 SUBSTITUIÇÕES AUTOMÁTICAS

### 1. Import de generateId
```bash
# Busca
import { generateId } from '@/domain/db';
import { db, generateId } from '@/domain/db';

# Substitui por
import { generateId } from '@/utils/idGenerator';
```

### 2. Import de useLiveQuery
```bash
# Busca
import { useLiveQuery } from 'dexie-react-hooks';

# Substitui por
// ⚠️ REMOVIDO: useLiveQuery não existe em v3.0
// Use useState + useEffect + Services
```

### 3. Import de db
```bash
# Busca
import { db } from '@/domain/db';

# Substitui por
// ⚠️ REMOVIDO: db local não existe em v3.0
// Use Services: import { depositService } from '@/services';
```

---

## 🚀 COMO EXECUTAR

### PowerShell (Windows)

```powershell
# 1. Substituir generateId
Get-ChildItem -Path "components","src/components" -Filter "*.tsx" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Substituir imports de generateId
    $content = $content -replace "import \{ generateId \} from '@/domain/db';", "import { generateId } from '@/utils/idGenerator';"
    $content = $content -replace "import \{ db, generateId \} from '@/domain/db';", "import { generateId } from '@/utils/idGenerator';"
    $content = $content -replace "import \{ generateId, db \} from '@/domain/db';", "import { generateId } from '@/utils/idGenerator';"
    
    Set-Content $_.FullName -Value $content
    Write-Host "✅ Atualizado: $($_.Name)"
}

# 2. Remover useLiveQuery (comentar linhas)
Get-ChildItem -Path "components","src/components" -Filter "*.tsx" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Comentar import de useLiveQuery
    $content = $content -replace "import \{ useLiveQuery \} from 'dexie-react-hooks';", "// ⚠️ REMOVIDO v3.0: import { useLiveQuery } from 'dexie-react-hooks';"
    
    Set-Content $_.FullName -Value $content
    Write-Host "✅ Comentado useLiveQuery: $($_.Name)"
}

# 3. Comentar imports de db
Get-ChildItem -Path "components","src/components" -Filter "*.tsx" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Comentar import de db
    $content = $content -replace "import \{ db \} from '@/domain/db';", "// ⚠️ REMOVIDO v3.0: import { db } from '@/domain/db';"
    
    Set-Content $_.FullName -Value $content
    Write-Host "✅ Comentado db: $($_.Name)"
}

Write-Host ""
Write-Host "🎉 Migração automática concluída!"
Write-Host "⚠️ ATENÇÃO: Componentes precisam ser revisados manualmente para usar Services"
```

---

## ⚠️ IMPORTANTE

### Depois de executar o script:

1. **Buscar todos os erros de compilação:**
   ```bash
   npm run build
   ```

2. **Revisar cada componente que usava `db.`:**
   - Substituir por chamadas a Services
   - Adicionar `try/catch` + `useToast()`

3. **Buscar usos de `useLiveQuery`:**
   ```bash
   grep -r "useLiveQuery" components/ src/components/
   ```
   - Substituir por `useState` + `useEffect` + Services

---

## 📝 EXEMPLO DE MIGRAÇÃO MANUAL

### ❌ ANTES (v2.1):
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/domain/db';

function Component() {
  const deposits = useLiveQuery(() => db.deposits.toArray());
  
  const handleCreate = async (data) => {
    await db.deposits.add(data);
  };
  
  return (/* ... */);
}
```

### ✅ DEPOIS (v3.0):
```typescript
import { useState, useEffect } from 'react';
import { depositService } from '@/services';
import { useToast } from '@/hooks/useToast';

function Component() {
  const [deposits, setDeposits] = useState([]);
  const { showSuccess, showError } = useToast();
  
  useEffect(() => {
    loadDeposits();
  }, []);
  
  const loadDeposits = async () => {
    try {
      const data = await depositService.getAll();
      setDeposits(data);
    } catch (error) {
      showError('Erro ao carregar depósitos', error);
    }
  };
  
  const handleCreate = async (data) => {
    try {
      await depositService.create(data);
      showSuccess('Depósito criado!');
      await loadDeposits(); // Recarrega lista
    } catch (error) {
      showError('Erro ao criar depósito', error);
    }
  };
  
  return (/* ... */);
}
```

---

## 🎯 COMPONENTES QUE PRECISAM DE REVISÃO

Após executar o script, estes componentes precisam ser migrados manualmente:

1. **OpeningShiftModal.tsx** - Usa `useLiveQuery` + `db.work_shifts`
2. **ShiftClosingModal.tsx** - Usa `useLiveQuery` + `db.work_shifts`
3. **NewServiceOrder.tsx** - Usa `useLiveQuery` + `db.` (várias tabelas)
4. **NewServiceOrderModal.tsx** - Usa `useLiveQuery` + `db.`
5. **ServiceOrderItems.tsx** - Usa `useLiveQuery` + `db.service_orders`
6. **NewClientModal.tsx** - Usa `useLiveQuery` + `db.delivery_sectors`
7. **ProductWizard/Step1Definition.tsx** - Usa `db.products`
8. **ProductWizard/Step2Pricing.tsx** - Usa `db.product_pricing`
9. **GlobalStatsDashboard.tsx** - Usa `useLiveQuery` + `db.` (múltiplas tabelas)

---

**Versão:** 3.0  
**Última Atualização:** 06/01/2026
