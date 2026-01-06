# 🏗️ ARQUITETURA DE SERVIÇOS (SERVICE PATTERN) - v3.0 ONLINE-ONLY

## 📋 Visão Geral

Esta pasta contém a **camada de serviço** do projeto - responsável por **toda comunicação direta** entre os componentes React e o Supabase (banco de dados). 

> **⚠️ ARQUITETURA v3.0 - ONLINE REAL-TIME:**  
> Conexão **DIRETA** ao Supabase. Sem Dexie, sem cache local, sem sincronização.  
> **Ou salva no servidor ou dá erro** - zero risco de dados sumirem.

### Por que Service Pattern?

**❌ ANTES (Código espalhado):**
```tsx
// Em DepositsPage.tsx
const { data } = await supabase.from('deposits').select('*');

// Em ProductsPage.tsx
const { data } = await supabase.from('deposits').select('*');

// Em StockPage.tsx
const { data } = await supabase.from('deposits').select('*');
```

**✅ DEPOIS (Centralizado + Tipado):**
```tsx
// Todos usam o mesmo serviço (com autocomplete!)
import { depositService } from '@/services';
const deposits = await depositService.getAll();
```

---

## 📁 Estrutura de Arquivos

```
src/services/
├── index.ts                    # Barrel export (ponto de entrada)
├── depositService.ts           # Gestão de depósitos
├── productService.ts           # Gestão de produtos
├── stockService.ts             # Gestão de estoque
├── serviceOrderService.ts      # Gestão de vendas (OS)
├── clientService.ts            # Gestão de clientes
├── financialService.ts         # Financeiro (caixa, contas)
├── deliveryService.ts          # Entregas
├── EXAMPLES.tsx                # Guia de uso (10 exemplos práticos)
└── README.md                   # Este arquivo
```

---

## 🎯 Regras de Ouro (v3.0 - Online-Only)

### 1. **TODA comunicação com Supabase passa por serviços**
```tsx
// ❌ ERRADO
const { data } = await supabase.from('products').select('*');

// ✅ CERTO
const products = await productService.getAll();
```

### 2. **NUNCA armazene dados no navegador**
```tsx
// ❌ PROIBIDO (v3.0)
localStorage.setItem('products', JSON.stringify(products));
await db.products.bulkPut(products); // Dexie removido!

// ✅ CERTO
const products = await productService.getAll(); // Sempre busca do servidor
```

### 3. **Serviços NÃO conhecem React**
- Sem `useState`, `useEffect`, `useContext`
- Apenas lógica de negócio pura
- Componentes chamam serviços, não o contrário

### 4. **Sempre use tipagem forte**
```tsx
// ✅ CERTO (VS Code te ajuda)
const deposit: Deposit = await depositService.getById('uuid');

// ❌ ERRADO
const deposit: any = await depositService.getById('uuid');
```

### 5. **SEMPRE trate erros de rede**
```tsx
try {
  await depositService.create({ name: 'Matriz' });
  showSuccess('Depósito criado!');
} catch (error) {
  showError('Sem conexão. Verifique sua internet.'); // ← Usuário precisa saber!
}
```

---

## 📦 Como Importar

### Método 1: Import Direto (Recomendado)
```tsx
import { depositService, productService } from '@/services';
```

### Método 2: Import com Tipos
```tsx
import {
  depositService,
  type Deposit,
  type NewDeposit
} from '@/services';
```

### Método 3: Supabase Client (quando necessário)
```tsx
import { supabase } from '@/services';
// Use apenas para operações não cobertas pelos serviços
```

---

## 🔍 Serviços Disponíveis

### 1. **depositService** (Depósitos)
```tsx
await depositService.getAll();
await depositService.getById(id);
await depositService.create({ name: 'Matriz' });
await depositService.update(id, { active: false });
await depositService.hasStock(id);
await depositService.hasSales(id);
```

### 2. **productService** (Produtos)
```tsx
await productService.getAll();
await productService.getByDeposit(depositId);
await productService.create({ name: 'Gás P13', type: 'GAS_CHEIO' });
await productService.getPricing(productId, depositId);
await productService.getFinalPrice(productId, depositId, 'EXCHANGE');
await productService.getReturnProduct(productId);
```

### 3. **stockService** (Estoque)
```tsx
await stockService.getBalance(productId, depositId);
await stockService.getBalancesByDeposit(depositId);
await stockService.addMovement({ ... });
await stockService.loadInitialStock(productId, depositId, 100);
await stockService.adjustStock(productId, depositId, 50, 'Ajuste manual');
await stockService.transfer(productId, fromId, toId, 10);
```

### 4. **serviceOrderService** (Vendas)
```tsx
await serviceOrderService.create({ order, items, payments });
await serviceOrderService.getById(id);
await serviceOrderService.getByDeposit(depositId);
await serviceOrderService.cancel(id, 'Motivo');
await serviceOrderService.getTodaySales(depositId);
await serviceOrderService.getTopProducts(depositId, startDate, endDate);
```

### 5. **clientService** (Clientes)
```tsx
await clientService.getAll();
await clientService.getByPhone('11999999999');
await clientService.create({ name: 'João Silva' });
await clientService.getBySector(sectorId);
await clientService.getWithDebt();
```

### 6. **financialService** (Financeiro)
```tsx
await financialService.getPendingReceivables(depositId);
await financialService.markReceivableAsPaid(id, methodId, amount);
await financialService.getOverdueReceivables(depositId);
await financialService.getPendingExpenses(depositId);
await financialService.openShift(userId, depositId, 100.00);
await financialService.closeShift(shiftId, { cash, card, pix });
await financialService.getDailySummary(depositId);
```

### 7. **deliveryService** (Entregas)
```tsx
await deliveryService.getZones();
await deliveryService.getSectorsByZone(zoneId);
await deliveryService.getDeliveryFee(zoneId, depositId);
await deliveryService.getPendingJobs(depositId);
await deliveryService.assignDriver(jobId, driverId);
await deliveryService.startDelivery(jobId);
await deliveryService.completeDelivery(jobId);
await deliveryService.getAvailableDrivers(depositId);
```

---

## 🎓 Exemplos Práticos

Veja o arquivo [EXAMPLES.tsx](./EXAMPLES.tsx) para **10 exemplos práticos** de uso dos serviços em componentes React:

1. Listagem simples
2. Criar depósito
3. Venda completa (complexo)
4. Consulta de estoque
5. Ajuste de estoque
6. Abertura de turno
7. Fechamento de turno
8. Produto com preço por depósito
9. Relatório de vendas
10. Clientes com débito

---

## 🏗️ Anatomia de um Serviço

```typescript
/**
 * 1. Imports
 */
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

/**
 * 2. Cliente Supabase (tipado)
 */
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * 3. Atalhos de tipos (facilita uso)
 */
export type Entity = Database['public']['Tables']['entity']['Row'];
export type NewEntity = Database['public']['Tables']['entity']['Insert'];

/**
 * 4. Objeto de serviço (namespace)
 */
export const entityService = {
  /**
   * 5. Métodos (sempre async)
   */
  async getAll(): Promise<Entity[]> {
    const { data, error } = await supabase
      .from('entity')
      .select('*');
    
    if (error) throw new Error(`Erro: ${error.message}`);
    return data || [];
  }
};
```

---

## 🚀 Benefícios da Arquitetura

### 1. **Separação de Responsabilidades**
- Componentes cuidam da UI
- Serviços cuidam da lógica de negócio
- Supabase cuida da persistência

### 2. **Reutilização de Código**
```tsx
// Mesmo código funciona em múltiplos componentes
const deposits = await depositService.getAll();
```

### 3. **Tipagem Forte**
- VS Code autocompleta campos
- Erros detectados antes de rodar
- Menos bugs em produção

### 4. **Fácil de Testar**
```typescript
// Mock simples
jest.mock('@/services', () => ({
  depositService: {
    getAll: jest.fn(() => Promise.resolve([{ id: '1', name: 'Test' }]))
  }
}));
```

### 5. **Fácil de Evoluir**
- Mudou a API do Supabase? Altera só o serviço
- Precisa de cache? Adiciona no serviço
- Precisa de log? Adiciona no serviço

---

## 🔄 Fluxo de Dados

```
┌─────────────┐
│  Component  │
│   (React)   │
└──────┬──────┘
       │ await depositService.getAll()
       ▼
┌─────────────┐
│   Service   │
│ (TypeScript)│
└──────┬──────┘
       │ supabase.from('deposits').select()
       ▼
┌─────────────┐
│  Supabase   │
│ (PostgreSQL)│
└─────────────┘
```

---

## 📝 Convenções de Nomenclatura

### Métodos CRUD
- `getAll()` - Listar todos
- `getById(id)` - Buscar por ID
- `create(data)` - Criar novo
- `update(id, data)` - Atualizar
- `delete(id)` - Deletar (físico)
- `deactivate(id)` - Desativar (soft delete)

### Métodos Específicos
- `getBy[Field]()` - Buscar por campo específico
- `check[Condition]()` - Verificar condição
- `has[Relation]()` - Verificar existência de relação
- `count[Entity]()` - Contar registros

### Retornos
- Array: `Promise<Entity[]>`
- Único: `Promise<Entity | null>`
- Void: `Promise<void>`

---

## 🛡️ Tratamento de Erros

### Padrão: Lançar erros descritivos
```typescript
if (error) throw new Error(`Erro ao criar depósito: ${error.message}`);
```

### Casos especiais: Retornar null
```typescript
if (error.code === 'PGRST116') return null; // Not found
```

### No componente: Sempre capturar
```tsx
try {
  await depositService.create(data);
  alert('Sucesso!');
} catch (error) {
  alert(`Erro: ${error.message}`);
}
```

---

## 🔗 Relacionamentos

### Buscar com joins
```typescript
const { data } = await supabase
  .from('service_orders')
  .select(`
    *,
    items:service_order_items(*),
    payments:service_order_payments(*)
  `);
```

### Buscar nested
```typescript
const { data } = await supabase
  .from('products')
  .select(`
    *,
    pricing:product_pricing!inner(sale_price)
  `)
  .eq('pricing.deposit_id', depositId);
```

---

## 🎯 Próximos Passos

1. **Leia** [EXAMPLES.tsx](./EXAMPLES.tsx) - 10 exemplos prontos
2. **Estude** os serviços existentes
3. **Migre** um componente por vez
4. **Teste** cada migração
5. **Documente** novos métodos

---

## 📚 Referências

- [Tipos Supabase](../types/supabase.ts)
- [Manifesto do Projeto](../../.github/copilot-instructions.md)
- [Documentação Supabase](https://supabase.com/docs)

---

**Última atualização:** 06/01/2026
