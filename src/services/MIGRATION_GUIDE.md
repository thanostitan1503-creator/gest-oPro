# 🚀 GUIA DE MIGRAÇÃO PASSO A PASSO

## 📋 Objetivo
Migrar componentes existentes que usam Supabase diretamente para usar a camada de serviços.

---

## 🎯 Exemplo Real: DepositsStockModule.tsx

### ❌ ANTES (Código antigo)
```tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey);

function DepositsStockModule() {
  const [deposits, setDeposits] = useState([]);

  async function loadDeposits() {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      setDeposits(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSave(formData) {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .insert({
          nome: formData.nome,
          endereco: formData.endereco,
          ativo: true,
          cor: formData.cor || '#3b82f6'
        })
        .select()
        .single();
      
      if (error) throw error;
      alert('Depósito criado!');
      loadDeposits();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    // ... JSX
  );
}
```

### ✅ DEPOIS (Com serviços)
```tsx
import { useState } from 'react';
import { depositService, type Deposit } from '@/services';

function DepositsStockModule() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  async function loadDeposits() {
    try {
      const data = await depositService.getAll();
      setDeposits(data);
    } catch (error: any) {
      console.error(error);
    }
  }

  async function handleSave(formData: any) {
    try {
      await depositService.create({
        name: formData.nome,
        address: formData.endereco,
        color: formData.cor || '#3b82f6'
      });
      
      alert('Depósito criado!');
      loadDeposits();
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    // ... JSX
  );
}
```

---

## 📝 Passo a Passo da Migração

### PASSO 1: Identificar Operações Supabase
Procure por:
```tsx
supabase.from('tabela')
await supabase
```

Liste todas as operações encontradas:
- [ ] Listar depósitos
- [ ] Criar depósito
- [ ] Atualizar depósito
- [ ] Deletar depósito

### PASSO 2: Importar Serviço Correspondente
```tsx
// Remover
import { createClient } from '@supabase/supabase-js';

// Adicionar
import { depositService, type Deposit } from '@/services';
```

### PASSO 3: Substituir Chamadas

#### SELECT (Listar)
```tsx
// ❌ ANTES
const { data, error } = await supabase
  .from('deposits')
  .select('*');
if (error) throw error;

// ✅ DEPOIS
const data = await depositService.getAll();
```

#### INSERT (Criar)
```tsx
// ❌ ANTES
const { data, error } = await supabase
  .from('deposits')
  .insert({ nome: 'Matriz' })
  .select()
  .single();

// ✅ DEPOIS
const data = await depositService.create({
  name: 'Matriz'
});
```

#### UPDATE (Atualizar)
```tsx
// ❌ ANTES
const { data, error } = await supabase
  .from('deposits')
  .update({ ativo: false })
  .eq('id', id);

// ✅ DEPOIS
await depositService.deactivate(id);
// OU
await depositService.update(id, { active: false });
```

#### DELETE (Deletar)
```tsx
// ❌ ANTES
const { error } = await supabase
  .from('deposits')
  .delete()
  .eq('id', id);

// ✅ DEPOIS
await depositService.delete(id);
```

### PASSO 4: Ajustar Nomes de Campos

**IMPORTANTE:** Supabase usa inglês, frontend usava português.

```tsx
// ❌ ANTES (português)
{
  nome: 'Matriz',
  endereco: 'Rua A',
  ativo: true
}

// ✅ DEPOIS (inglês - conforme Supabase)
{
  name: 'Matriz',
  address: 'Rua A',
  active: true
}
```

**Mapeamento comum:**
| Português | Inglês |
|-----------|--------|
| nome | name |
| endereco | address |
| telefone | phone |
| ativo | active |
| preco_venda | sale_price |
| preco_custo | cost_price |
| quantidade | quantity |
| tipo | type |

### PASSO 5: Adicionar Tipagem
```tsx
// ❌ ANTES
const [deposits, setDeposits] = useState([]);

// ✅ DEPOIS
const [deposits, setDeposits] = useState<Deposit[]>([]);
```

### PASSO 6: Testar
1. Abra o componente no browser
2. Teste todas as operações
3. Verifique console do browser (F12)
4. Verifique dados no Supabase Dashboard

---

## 🔄 Casos Especiais

### Caso 1: Query Complexa (Joins)
```tsx
// ❌ ANTES
const { data } = await supabase
  .from('service_orders')
  .select(`
    *,
    items:service_order_items(*),
    payments:service_order_payments(*)
  `)
  .eq('deposit_id', depositId);

// ✅ DEPOIS
const data = await serviceOrderService.getByDeposit(depositId);
```

### Caso 2: Filtros Customizados
```tsx
// ❌ ANTES
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tipo', 'GAS_CHEIO')
  .eq('ativo', true);

// ✅ DEPOIS
const data = await productService.getByType('GAS_CHEIO');
```

Se o método não existir no serviço, **ADICIONE**:
```typescript
// Em productService.ts
async getByType(type: Product['type']): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('type', type)
    .eq('is_active', true);
  
  if (error) throw new Error(`Erro: ${error.message}`);
  return data || [];
}
```

### Caso 3: RPC (Functions)
```tsx
// ❌ ANTES
const { data } = await supabase
  .rpc('get_stock_balance', { product_id: id });

// ✅ DEPOIS
const data = await stockService.getBalance(id, depositId);
```

---

## 🧪 Checklist de Migração

Para cada componente:

- [ ] **Identificar** todas as chamadas Supabase
- [ ] **Mapear** para serviços existentes
- [ ] **Criar** métodos faltantes (se necessário)
- [ ] **Substituir** `supabase.from()` por `service.method()`
- [ ] **Ajustar** nomes de campos (PT → EN)
- [ ] **Adicionar** tipagem (`type Deposit`)
- [ ] **Testar** todas as funcionalidades
- [ ] **Verificar** erros no console
- [ ] **Remover** imports do Supabase
- [ ] **Commitar** mudanças

---

## 🎯 Ordem Recomendada de Migração

### Prioridade 1 (Mais Simples)
1. `DepositsStockModule.tsx` - CRUD básico
2. `ClientsModule.tsx` - CRUD básico
3. `EmployeesModule.tsx` - CRUD básico

### Prioridade 2 (Média Complexidade)
4. `NewServiceOrder.tsx` - Venda (complexo)
5. `FinancialModule.tsx` - Contas a receber/pagar
6. `DeliveryDispatchModule.tsx` - Entregas

### Prioridade 3 (Alta Complexidade)
7. `CashRegisterClosing.tsx` - Fechamento de caixa
8. `SummaryModule.tsx` - Relatórios
9. `AuditModule.tsx` - Logs

---

## 🚨 Armadilhas Comuns

### 1. Esquecer de tratar erros
```tsx
// ❌ ERRADO
const deposits = await depositService.getAll();

// ✅ CERTO
try {
  const deposits = await depositService.getAll();
} catch (error: any) {
  alert(`Erro: ${error.message}`);
}
```

### 2. Usar 'any' em vez de tipagem
```tsx
// ❌ ERRADO
const deposits: any = await depositService.getAll();

// ✅ CERTO
const deposits: Deposit[] = await depositService.getAll();
```

### 3. Misturar campos PT e EN
```tsx
// ❌ ERRADO
await depositService.create({
  nome: 'Matriz',  // ❌ português
  address: 'Rua A' // ✅ inglês
});

// ✅ CERTO
await depositService.create({
  name: 'Matriz',
  address: 'Rua A'
});
```

### 4. Não remover imports antigos
```tsx
// ❌ ERRADO (imports não usados)
import { createClient } from '@supabase/supabase-js';
import { depositService } from '@/services';

// ✅ CERTO
import { depositService } from '@/services';
```

---

## 📊 Progresso da Migração

Acompanhe o progresso aqui:

### Componentes Migrados (0/30)
- [ ] `DepositsStockModule.tsx`
- [ ] `ClientsModule.tsx`
- [ ] `EmployeesModule.tsx`
- [ ] `NewServiceOrder.tsx`
- [ ] `FinancialModule.tsx`
- [ ] `DeliveryDispatchModule.tsx`
- [ ] `CashRegisterClosing.tsx`
- [ ] `SummaryModule.tsx`
- [ ] `AlertsModule.tsx`
- [ ] `AuditModule.tsx`
- [ ] (... adicione mais conforme necessário)

### Serviços Implementados (7/7) ✅
- [x] `depositService`
- [x] `productService`
- [x] `stockService`
- [x] `serviceOrderService`
- [x] `clientService`
- [x] `financialService`
- [x] `deliveryService`

---

## 🎓 Exemplo Completo: NewServiceOrder.tsx

### Estrutura
1. Buscar produtos do depósito
2. Calcular preço baseado em modalidade (TROCA/COMPLETA)
3. Buscar taxa de entrega (se DELIVERY)
4. Criar O.S. completa (ordem + itens + pagamentos)
5. Atualizar estoque automaticamente

```tsx
import { useState, useEffect } from 'react';
import {
  productService,
  serviceOrderService,
  deliveryService,
  type Product
} from '@/services';

function NewServiceOrder({ depositId }: { depositId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
  }, [depositId]);

  async function loadProducts() {
    try {
      const data = await productService.getByDeposit(depositId);
      setProducts(data);
    } catch (error: any) {
      console.error(error);
    }
  }

  async function handleSubmit(formData: any) {
    try {
      // 1. Calcula preços
      const items = await Promise.all(
        selectedItems.map(async (item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: await productService.getFinalPrice(
            item.productId,
            depositId,
            item.saleMovementType
          ),
          sale_movement_type: item.saleMovementType
        }))
      );

      const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);

      // 2. Taxa de entrega
      let deliveryFee = 0;
      if (formData.serviceType === 'DELIVERY' && formData.zoneId) {
        deliveryFee = await deliveryService.getDeliveryFee(formData.zoneId, depositId);
      }

      // 3. Cria O.S. (com estoque automático!)
      const order = await serviceOrderService.create({
        order: {
          order_number: `OS-${Date.now()}`,
          deposit_id: depositId,
          client_name: formData.clientName,
          service_type: formData.serviceType,
          total: subtotal + deliveryFee,
          delivery_fee: deliveryFee
        },
        items,
        payments: [{
          payment_method_id: formData.paymentMethodId,
          amount: subtotal + deliveryFee
        }]
      });

      alert(`Venda ${order.order_number} criada!`);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    <div>
      {/* UI aqui */}
    </div>
  );
}
```

---

## 🎉 Benefícios Após Migração

1. **Código 50% menor** nos componentes
2. **Sem lógica duplicada** entre telas
3. **Erros detectados antes** (tipagem)
4. **Fácil de testar** (mock de serviços)
5. **Manutenção simplificada** (um lugar só)

---

**Última atualização:** 06/01/2026
