# 🔧 CORREÇÃO: Erro 22P02 - IDs Inválidos no Supabase

## 🚨 PROBLEMA IDENTIFICADO

**Erro do Supabase:**
```
ERROR: invalid input syntax for type uuid: "COL-1736200123-456"
Error Code: 22P02
```

**Causa Raiz:**
O código estava gerando IDs manualmente com prefixos (`COL-`, `PROD-`, `DEP-`, etc.) e timestamps, mas as colunas no Supabase são do tipo **UUID**.

---

## ❌ CÓDIGO ANTIGO (ERRADO)

### 1. Geração de IDs com Prefixos
```typescript
// ❌ ERRADO - Gera string inválida
const generateId = () => `COL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Exemplo de ID gerado: "COL-1736200123-456"
// ⚠️ PostgreSQL rejeita: não é um UUID válido!
```

### 2. Repositórios Locais (Dexie)
```typescript
// ❌ ERRADO - Usava Dexie para gerar IDs
export async function upsertEmployee(employee: Colaborador) {
  const entity = employee.id 
    ? employee 
    : { ...employee, id: generateId() }; // ← ID inválido!
  
  await db.employees.put(entity);
}
```

### 3. Componentes Enviando IDs Manualmente
```typescript
// ❌ ERRADO - Component criava ID antes de enviar
const newEmp: Colaborador = {
  id: form.id || generateId(), // ← "COL-123..."
  nome: form.nome,
  // ...
};
```

---

## ✅ CÓDIGO NOVO (CORRETO)

### 1. UUID Generator Nativo
```typescript
// ✅ CORRETO - Usa crypto.randomUUID() nativo
export function generateId(): string {
  return crypto.randomUUID();
}

// Exemplo de ID gerado: "550e8400-e29b-41d4-a716-446655440000"
// ✅ PostgreSQL aceita!
```

### 2. Services com .insert() sem ID
```typescript
// ✅ CORRETO - NÃO envia 'id', Supabase gera automaticamente
export const employeeService = {
  async create(employee: NewEmployee): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .insert(employee) // ← SEM campo 'id'!
      .select()
      .single();

    if (error) throw error;
    return data; // ← Supabase retorna com 'id' gerado
  }
};
```

### 3. Tabelas com DEFAULT uuid_generate_v4()
```sql
-- ✅ CORRETO - Supabase gera ID automaticamente
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  -- ...
);
```

---

## 📋 ARQUIVOS CORRIGIDOS

| Arquivo | Mudança |
|---------|---------|
| `src/utils/idGenerator.ts` | ✅ Usa `crypto.randomUUID()` |
| `src/services/employeeService.ts` | ✅ Criado do zero (não envia ID) |
| `src/services/index.ts` | ✅ Exporta `employeeService` |
| `components/EmployeesModule.tsx` | ✅ Removido `generateId()` com prefixo |
| `src/services/EXAMPLES.tsx` | ✅ Removido `order_number: OS-${Date.now()}` |

---

## 🎯 REGRAS DEFINITIVAS

### ✅ FAZER:
1. **NÃO enviar campo `id`** no `.insert()` - deixar Supabase gerar
2. **Se precisar do ID no front antes de salvar:** usar `crypto.randomUUID()`
3. **Validar IDs recebidos:** usar `isValidUUID()` do `idGenerator.ts`

### ❌ NÃO FAZER:
1. **Nunca** criar IDs com prefixos (`COL-`, `PROD-`, etc.)
2. **Nunca** usar `Date.now()` ou timestamp como ID
3. **Nunca** usar strings aleatórias que não sejam UUID v4

---

## 🧪 TESTE RÁPIDO

```typescript
// ✅ Testar criação de colaborador
import { employeeService } from '@/services';
import { useToast } from '@/hooks/useToast';

const { showSuccess, showError } = useToast();

try {
  const gerente = await employeeService.create({
    name: 'João Silva',
    role: 'GERENTE',
    deposit_id: null, // null = acesso global
    username: 'joao',
    password: 'senha123'
  });
  
  console.log('✅ Colaborador criado:', gerente.id);
  // ID retornado será UUID válido: "550e8400-e29b-41d4-..."
  showSuccess('Gerente criado com sucesso!');
} catch (error) {
  console.error('❌ Erro:', error);
  showError('Erro ao criar colaborador', error);
}
```

---

## 🔍 COMO VERIFICAR SE O PROBLEMA FOI RESOLVIDO

1. **Abrir Console do Navegador** (F12)
2. **Tentar criar um colaborador**
3. **Verificar o ID retornado:**
   ```
   ✅ CORRETO: "550e8400-e29b-41d4-a716-446655440000"
   ❌ ERRADO: "COL-1736200123-456"
   ```

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- [UUID no PostgreSQL](https://www.postgresql.org/docs/current/datatype-uuid.html)
- [crypto.randomUUID() MDN](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- [Supabase Default Values](https://supabase.com/docs/guides/database/tables#default-values)

---

**Versão:** 3.0  
**Data da Correção:** 06/01/2026  
**Prioridade:** 🔴 CRÍTICA (bloqueava todas as operações de insert)
