# 🎨 GUIA DE USO: TOAST (Feedback Visual v3.0)

> **Versão:** 3.0 - Online-Only  
> **Biblioteca:** Sonner (react-toaster)  
> **Hook:** `useToast()`

---

## 📋 VISÃO GERAL

Na arquitetura v3.0, **erros NÃO devem ser silenciosos**. O usuário precisa saber imediatamente se uma operação falhou ou teve sucesso.

### ❌ ANTES (v2.1 - Offline):
```typescript
// Erro era escondido, dados iam para fila
await db.deposits.add(deposit);
// ⚠️ Usuário não sabia se salvou ou não!
```

### ✅ DEPOIS (v3.0 - Online):
```typescript
import { useToast } from '@/hooks/useToast';
const { showSuccess, showError } = useToast();

try {
  await depositService.create(deposit);
  showSuccess('Depósito criado com sucesso!'); // 🟢 Toast verde
} catch (error) {
  showError('Erro ao criar depósito', error); // 🔴 Toast vermelho com detalhes
}
```

---

## 🎯 QUANDO USAR CADA TIPO DE TOAST

| Tipo | Quando Usar | Cor |
|------|-------------|-----|
| `showSuccess()` | Operação bem-sucedida (salvar, deletar, atualizar) | 🟢 Verde |
| `showError()` | Falha de operação (sem conexão, erro do banco) | 🔴 Vermelho |
| `showWarning()` | Aviso (ex: "Estoque baixo", "Ação irreversível") | 🟡 Amarelo |
| `showInfo()` | Informação neutra (ex: "Sincronização completa") | 🔵 Azul |
| `showLoading()` | Operação em andamento (manual) | ⚪ Cinza (spinner) |
| `showPromise()` | Operação assíncrona (automático success/error) | Automático |

---

## 📖 EXEMPLOS PRÁTICOS

### 1. CRUD Básico (Criar, Atualizar, Deletar)

```typescript
import { useToast } from '@/hooks/useToast';
import { depositService } from '@/services';

function DepositsModule() {
  const { showSuccess, showError } = useToast();

  const handleCreate = async (data) => {
    try {
      await depositService.create(data);
      showSuccess('Depósito criado com sucesso!');
    } catch (error) {
      showError('Erro ao criar depósito', error);
    }
  };

  const handleUpdate = async (id, updates) => {
    try {
      await depositService.update(id, updates);
      showSuccess('Depósito atualizado!');
    } catch (error) {
      showError('Erro ao atualizar depósito', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await depositService.delete(id);
      showSuccess('Depósito excluído!');
    } catch (error) {
      showError('Erro ao excluir depósito', error);
    }
  };

  return (/* ... */);
}
```

---

### 2. Loading Manual (Operações Longas)

```typescript
import { useToast } from '@/hooks/useToast';
import { stockService } from '@/services';

function StockModule() {
  const { showSuccess, showError, showLoading } = useToast();

  const handleLoadInitialStock = async () => {
    const dismiss = showLoading('Carregando estoque inicial...');
    
    try {
      await stockService.loadInitialStock(depositId, items);
      dismiss(); // Fecha o loading
      showSuccess('Estoque carregado com sucesso!');
    } catch (error) {
      dismiss(); // Fecha o loading
      showError('Erro ao carregar estoque', error);
    }
  };

  return (/* ... */);
}
```

---

### 3. Promise Automática (Mais Simples)

```typescript
import { useToast } from '@/hooks/useToast';
import { clientService } from '@/services';

function ClientsModule() {
  const { showPromise } = useToast();

  const handleCreate = async (data) => {
    // Toast automático: loading → success/error
    await showPromise(
      clientService.create(data),
      {
        loading: 'Criando cliente...',
        success: 'Cliente criado com sucesso!',
        error: 'Erro ao criar cliente'
      }
    );
  };

  return (/* ... */);
}
```

---

### 4. Aviso Antes de Ação Destrutiva

```typescript
import { useToast } from '@/hooks/useToast';
import { depositService } from '@/services';

function DepositsModule() {
  const { showWarning, showSuccess, showError } = useToast();

  const handleDelete = async (id) => {
    showWarning(
      'Atenção!',
      'Você está prestes a deletar este depósito. Esta ação é irreversível.'
    );

    // Aguardar confirmação do usuário (ex: modal)
    const confirmed = await confirmModal();
    if (!confirmed) return;

    try {
      await depositService.delete(id);
      showSuccess('Depósito excluído!');
    } catch (error) {
      showError('Erro ao excluir depósito', error);
    }
  };

  return (/* ... */);
}
```

---

### 5. Erros Detalhados do Supabase

```typescript
import { useToast } from '@/hooks/useToast';
import { productService } from '@/services';

function ProductsModule() {
  const { showError } = useToast();

  const handleCreate = async (data) => {
    try {
      await productService.create(data);
    } catch (error) {
      // useToast extrai AUTOMATICAMENTE:
      // - error.message
      // - error.details
      // - error.code
      // - error.hint
      showError('Erro ao criar produto', error);
      
      // Exemplo de toast exibido:
      // 🔴 Erro ao criar produto
      //    duplicate key value violates unique constraint "products_code_key"
      //    Código: 23505
      //    Dica: Key (code)=(P13) already exists.
    }
  };

  return (/* ... */);
}
```

---

### 6. Múltiplas Operações (Batch)

```typescript
import { useToast } from '@/hooks/useToast';
import { stockService } from '@/services';

function StockModule() {
  const { showLoading, showSuccess, showError, showInfo } = useToast();

  const handleBatchUpdate = async (items) => {
    const dismiss = showLoading(`Atualizando ${items.length} itens...`);
    
    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      try {
        await stockService.adjustStock(item.id, item.quantity, 'ADJUSTMENT');
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Erro no item ${item.id}:`, error);
      }
    }

    dismiss();

    if (errorCount === 0) {
      showSuccess(`${successCount} itens atualizados com sucesso!`);
    } else {
      showWarning(
        'Atualização parcial',
        `${successCount} sucesso, ${errorCount} falhas. Veja o console.`
      );
    }
  };

  return (/* ... */);
}
```

---

### 7. Feedback de Sincronização (Informativo)

```typescript
import { useToast } from '@/hooks/useToast';

function SyncButton() {
  const { showInfo, showSuccess, showError } = useToast();

  const handleSync = async () => {
    showInfo('Iniciando sincronização...');

    try {
      // v3.0: Não existe mais sincronização local→cloud
      // Mas o toast pode ser usado para outras operações
      await someBackgroundTask();
      showSuccess('Sincronização completa!');
    } catch (error) {
      showError('Erro na sincronização', error);
    }
  };

  return <button onClick={handleSync}>Sincronizar</button>;
}
```

---

## 🎨 PERSONALIZAÇÃO

### Mudar Posição dos Toasts

Em `App.tsx`:
```tsx
<Toaster 
  richColors 
  closeButton 
  position="top-right"  // Opções: top-left, top-right, bottom-left, bottom-right
/>
```

### Mudar Duração

No hook `useToast()`:
```typescript
const showSuccess = (message: string, description?: string) => {
  toast.success(message, {
    description,
    duration: 5000, // ← Altere aqui (ms)
    position: 'top-right',
  });
};
```

---

## ⚠️ BOAS PRÁTICAS

### ✅ FAZER:
- Sempre mostrar toast após operações de CRUD
- Usar `showError(message, error)` para capturar detalhes técnicos
- Usar `showLoading()` para operações > 2 segundos
- Usar `showWarning()` antes de ações destrutivas

### ❌ NÃO FAZER:
- **NUNCA** esconder erros (sem try/catch ou sem toast)
- **NUNCA** usar `alert()` ou `console.log()` como único feedback
- **NUNCA** mostrar mensagens genéricas ("Erro desconhecido") quando o Supabase dá detalhes

---

## 🐛 TROUBLESHOOTING

### Problema: Toast não aparece

**Causa:** `<Toaster />` não está no `App.tsx`  
**Solução:**
```tsx
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      {/* Seu código */}
      <Toaster richColors closeButton position="top-right" />
    </>
  );
}
```

### Problema: Erro não mostra detalhes

**Causa:** Service está capturando erro com `throw new Error()`  
**Solução:** Lançar erro original do Supabase:
```typescript
// ❌ ERRADO
if (error) throw new Error(error.message);

// ✅ CERTO
if (error) throw error; // Preserva details, code, hint
```

---

## 📚 REFERÊNCIAS

- [Sonner (Documentação)](https://sonner.emilkowal.ski/)
- [useToast Hook](../src/hooks/useToast.ts)
- [Manifesto v3.0](.github/copilot-instructions.md)

---

**Versão:** 3.0  
**Última Atualização:** 06/01/2026  
**Status:** ✅ Sistema de feedback visual implementado
