# 🧠 MANIFESTO DO PROJETO: ERP DISTRIBUIDORA DE GÁS (GasDistributionERP)

> **VERSÃO:** 3.0 - ONLINE REAL-TIME | **DATA:** 06/01/2026  
> **LEIA COMPLETAMENTE ANTES DE QUALQUER ALTERAÇÃO**  
> **⚠️ MUDANÇA CRÍTICA:** Migrado de Offline-First para **Online-Only (Aplicativo Web)**

---

## 🌐 TIPO DE APLICATIVO: WEB APP (Como um Site)

**O projeto NÃO é mais um app offline.** É um **aplicativo web moderno** hospedado na **Vercel.com**, acessado via navegador.

### Características:
- 🌐 **100% Online:** Requer internet o tempo todo
- 🖥️ **Acessível via navegador:** `https://seuerp.vercel.app`
- 📱 **Multiplataforma:** Funciona em Android, iOS, Windows, Mac, Linux
- 🚀 **PWA (Progressive Web App):** Pode ser "instalado" como app, mas ainda precisa de internet
- ❌ **NÃO funciona offline:** Se a conexão cair, o sistema para (com aviso claro ao usuário)

---

## 1. RESUMO DO PROJETO

Sistema ERP (Enterprise Resource Planning) focado na gestão de **Distribuidoras de Gás e Água**. O objetivo é substituir planilhas e controles manuais por um sistema web moderno, **online em tempo real**, centralizado e seguro.

### 🎯 ARQUITETURA v3.0: "ONLINE REAL-TIME"
**Zero Complexidade, 100% Confiável**

- ✅ **Conexão Direta:** Frontend (Vercel) → Supabase (sem intermediários)
- ✅ **Fonte Única da Verdade:** Supabase é o único banco de dados
- ✅ **Zero Cache Local:** Dados nunca ficam presos no navegador
- ✅ **Erros Transparentes:** Se falhar, avisa na hora (toast vermelho)
- ✅ **Hospedagem Moderna:** Vercel.com (frontend) + Supabase.com (backend)
- ✅ **Deploy Automático:** `git push` → Site atualiza em 2 minutos

**Escopo Principal:**
- PDV/Frente de Caixa (vendas)
- Controle de Estoque (com lógica de vasilhames)
- Logística de Entrega
- Financeiro (caixa, contas a pagar/receber)
- Multi-depósito (mesma empresa, várias lojas)

---

## 2. STACK TECNOLÓGICA

| Camada | Tecnologia | Observações |
|--------|------------|-------------|
| **Frontend** | React + TypeScript | Vite como bundler |
| **Estilização** | Tailwind CSS | Mobile-first |
| **Banco de Dados** | Supabase (PostgreSQL) | **ÚNICO** banco - nada local |
| **Autenticação** | Supabase Auth | - |
| **Hospedagem Frontend** | Vercel | Deploy automático |
| **IDs** | UUID v4 | Obrigatório em todas as tabelas |
| **Ambiente** | VS Code (Windows) | - |

### 2.1 Arquitetura Online Real-Time (CRÍTICO)

**IMPORTANTE:** Este é um **aplicativo web (SPA)** hospedado na Vercel, **NÃO** um app nativo com banco local.

```
┌──────────────────────────────────────────────────────┐
│              USUÁRIO FINAL                           │
│     Abre navegador: https://seuerp.vercel.app        │
│     (Gerente, Entregador, Atendente)                 │
└────────────────────┬─────────────────────────────────┘
                     │ HTTPS (Requer internet 100%)
                     ▼
┌──────────────────────────────────────────────────────┐
│         VERCEL (Hospedagem Frontend)                 │
│                                                      │
│  - React build (HTML/CSS/JS estáticos)               │
│  - CDN global (rápido)                               │
│  - Deploy automático (git push)                      │
│                                                      │
└────────────────────┬─────────────────────────────────┘
                     │ Conexão Direta (supabase-js)
                     ▼
┌──────────────────────────────────────────────────────┐
│         SUPABASE (Backend/Servidor)                  │
│                                                      │
│  - PostgreSQL (40 tabelas)                           │
│  - Fonte única da verdade                            │
│  - Autenticação + RLS                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Regras Fundamentais:**
1. **NUNCA armazenar dados no navegador** (sem LocalStorage, sem IndexedDB)
2. **Toda operação vai DIRETO para o Supabase**
3. Se a requisição falhar: **mostra erro e NÃO salva nada**
4. Se a internet cair: **usuário vê "Sem Conexão" imediatamente**
5. Dados só existem no Supabase - **zero risco de "sumir" depois**
6. **Deploy:** `git push origin main` → Vercel atualiza site em ~2 minutos

### 2.2 Tratamento de Erros de Rede

```typescript
// ✅ JEITO CORRETO (v3.0)
try {
  const { data, error } = await supabase.from('deposits').insert(deposit);
  if (error) throw error;
  // Sucesso: atualiza UI
  return data;
} catch (err) {
  // Falhou: mostra erro ao usuário
  showError('Sem conexão. Verifique sua internet e tente novamente.');
  throw err; // NÃO salva nada localmente
}
```

---

## 3. GLOSSÁRIO DE TERMOS DO NEGÓCIO

| Termo | Significado |
|-------|-------------|
| **Depósito** | Loja física (ex: Matriz, Filial Centro) |
| **Vasilhame/Casco** | Botijão vazio (ativo da empresa) |
| **Cheio** | Botijão com gás |
| **Troca** | Cliente devolve vazio e leva cheio |
| **Venda Completa** | Cliente compra cheio + casco (não devolve nada) |
| **O.S.** | Ordem de Serviço (registro de venda) |
| **Zona** | Região geográfica de entrega |
| **Setor** | Subdivisão de uma zona |

---

## 4. TIPOS DE ATENDIMENTO (REGRA ABSOLUTA) ⚠️

> **EXISTEM APENAS 2 TIPOS. QUALQUER OUTRO DEVE SER REMOVIDO/MIGRADO.**

| Tipo | Código | Descrição |
|------|--------|-----------|
| **Balcão** | `BALCAO` | Cliente vai até o depósito buscar |
| **Delivery** | `DELIVERY` | Entregador leva até o cliente |

### ❌ TIPOS PROIBIDOS (REMOVER DO CÓDIGO):
- `RETIRADA` → Migrar para `BALCAO`
- `ENTREGA` → Migrar para `DELIVERY`
- Qualquer outro valor → **ERRO**

**TypeScript (ÚNICA definição válida):**
```typescript
export type TipoAtendimento = 'BALCAO' | 'DELIVERY';
```

---

## 5. TIPOS DE MOVIMENTAÇÃO DE ESTOQUE (`movement_type` e `sale_movement_type`)

### ⚠️ CONCEITO FUNDAMENTAL

Existem **DOIS** níveis de configuração de movimento:

1. **`movement_type` (no PRODUTO):** Define o comportamento PADRÃO do produto
2. **`sale_movement_type` (no ITEM DA O.S.):** Define a escolha feita NO MOMENTO DA VENDA

> **PRIORIDADE:** O `sale_movement_type` do ITEM sempre prevalece sobre o `movement_type` do PRODUTO.

| Tipo | Código | Descrição | Movimento de Estoque |
|------|--------|-----------|---------------------|
| **Simples** | `SIMPLE` | Venda sem retorno de vasilhame | Só SAÍDA do produto |
| **Troca** | `EXCHANGE` | Troca de vasilhame | SAÍDA cheio + ENTRADA vazio |
| **Completa** | `FULL` | Vende produto + casco (cliente novo) | Só SAÍDA (sem entrada de vazio) |

### 5.1 Fluxo de Venda com Escolha de Modalidade

Quando um produto tem `movement_type = 'EXCHANGE'`, o sistema **PERGUNTA ao operador** no momento da venda:

```
┌─────────────────────────────────────────────────┐
│           TIPO DE VENDA - Gás P13               │
├─────────────────────────────────────────────────┤
│                                                 │
│  🔁 TROCA              R$ 130,00                │
│     Cliente devolve casco vazio                 │
│                                                 │
│  📦 COMPLETA           R$ 220,00                │
│     Cliente leva o casco (cliente novo)         │
│                                                 │
└─────────────────────────────────────────────────┘
```

A escolha é gravada no campo `sale_movement_type` do item da O.S.

### 5.2 Exemplos Práticos

**Cenário 1: Venda de Gás P13 com Troca (EXCHANGE)**
```
Cliente: "Quero trocar meu botijão vazio por um cheio"
Operador: Seleciona "TROCA" no modal
Preço aplicado: preco_troca (R$ 130,00)
Movimento:
  - SAÍDA: 1x "Gás P13 Cheio"
  - ENTRADA: 1x "Gás P13 Vazio"
```

**Cenário 2: Venda de Gás P13 Completa (FULL)**
```
Cliente: "Não tenho botijão, quero comprar tudo"
Operador: Seleciona "COMPLETA" no modal
Preço aplicado: preco_completa (R$ 220,00)
Movimento:
  - SAÍDA: 1x "Gás P13 Cheio" (não entra vazio porque cliente levou o casco)
```

**Cenário 3: Venda de Água 20L (SIMPLE)**
```
Cliente: "Quero uma água"
(Sem modal - produto é SIMPLE)
Movimento:
  - SAÍDA: 1x "Água 20L"
```

### 5.3 Vinculação de Produtos (EXCHANGE)

Quando um produto é criado com `movement_type = 'EXCHANGE'`:

1. **Obrigatório** vincular ao produto "vazio" correspondente
2. Vincular via campo `return_product_id` no produto cheio
3. O produto vazio deve ter `movement_type = 'SIMPLE'` e `tipo = 'VASILHAME_VAZIO'`

```typescript
// Produto Cheio (GAS)
{
  id: "uuid-gas-p13-cheio",
  nome: "Gás P13",
  tipo: "GAS_CHEIO",
  movement_type: "EXCHANGE",
  return_product_id: "uuid-gas-p13-vazio", // ← Vínculo obrigatório
  preco_troca: 130.00,      // ← Preço quando cliente DEVOLVE casco
  preco_completa: 220.00,   // ← Preço quando cliente LEVA casco
}

// Produto Vazio (VASILHAME)
{
  id: "uuid-gas-p13-vazio",
  nome: "Vasilhame P13 (Vazio)",
  tipo: "VASILHAME_VAZIO",
  movement_type: "SIMPLE",
  return_product_id: null,
}
```

### 5.4 Lógica de Cálculo de Estoque

A função `calcularMovimentosEstoque` segue esta prioridade:

```typescript
// PRIORIDADE 1: sale_movement_type do ITEM (escolhido na venda)
const itemSaleMode = item.sale_movement_type;

// PRIORIDADE 2: movement_type do PRODUTO (cadastro)
const productMovementType = produto.movement_type;

// Modo efetivo = itemSaleMode ?? productMovementType
if (effectiveMode === 'EXCHANGE') {
  // Gera entrada de vazio
} else if (effectiveMode === 'FULL') {
  // NÃO gera entrada de vazio
}
```

---

## 6. SISTEMA DE PREÇOS

### 6.1 Hierarquia de Preços

```
┌─────────────────────────────────────────────────────────┐
│                    PREÇO FINAL DA O.S.                  │
├─────────────────────────────────────────────────────────┤
│  = Preço do Produto (por depósito via product_pricing)  │
│  + Taxa de Entrega (se DELIVERY, via zone_pricing)      │
│  - Desconto do Cliente (se houver)                      │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Tabelas de Preço

| Tabela | Propósito | Chave Única |
|--------|-----------|-------------|
| `product_pricing` | Preço do PRODUTO por depósito | `(product_id, deposit_id)` |
| `zone_pricing` | Taxa de ENTREGA por zona por depósito | `(zone_id, deposit_id)` |

### 6.3 Regras de Precificação

1. **Preço do Produto:**
   - Fonte da verdade: `product_pricing` (por depósito)
   - O campo `products.preco_venda` é apenas **fallback**
   - Cada depósito define seu próprio preço para cada produto

2. **Taxa de Entrega (Zone Pricing):**
   - Só se aplica quando `tipoAtendimento = 'DELIVERY'`
   - Cada depósito define sua taxa para cada zona
   - Uma zona pode custar diferente em cada depósito (proximidade geográfica)

**Exemplo:**
```
Produto: Gás P13
Depósito A (Centro): R$ 110,00
Depósito B (Zona Sul): R$ 115,00
Depósito C (Zona Norte): R$ 108,00

Zona "Jardim América":
  - Entrega pelo Depósito A: R$ 10,00
  - Entrega pelo Depósito B: R$ 5,00 (mais perto)
  - Entrega pelo Depósito C: R$ 15,00 (mais longe)
```

### 6.4 Taxa de Entrega na O.S.

> ⚠️ **IMPORTANTE:** A taxa de entrega **NÃO É UM PRODUTO**. Deve ser um campo separado na O.S.

```typescript
interface OrdemServico {
  // ... outros campos
  delivery_fee: number; // Taxa de entrega (0 se BALCAO)
}
```

---

## 7. FLUXO DE STATUS DA ENTREGA (DELIVERY)

### 7.1 Máquina de Estados

```
┌──────────┐     ┌───────────────────┐     ┌─────────┐     ┌───────────┐
│  CRIADA  │────▶│ PENDENTE_ENTREGA  │────▶│ EM_ROTA │────▶│ CONCLUIDA │
└──────────┘     └───────────────────┘     └─────────┘     └───────────┘
                          │                     │
                          │                     ▼
                          │               ┌───────────┐
                          │               │ DEVOLVIDA │
                          │               └───────────┘
                          ▼
                    ┌───────────┐
                    │ CANCELADA │
                    └───────────┘
```

### 7.2 Status Permitidos

| Status | Código | Descrição | Quem Altera |
|--------|--------|-----------|-------------|
| Criada | `CRIADA` | O.S. acabou de ser registrada | Sistema |
| Pendente | `PENDENTE_ENTREGA` | Aguardando entregador sair | Operador |
| Em Rota | `EM_ROTA` | Entregador saiu para entregar | Operador |
| Concluída | `CONCLUIDA` | Entrega realizada com sucesso | Operador |
| Devolvida | `DEVOLVIDA` | Entrega falhou, produto retornou | Operador |
| Cancelada | `CANCELADA` | O.S. cancelada | Operador/Admin |

### ❌ STATUS PROIBIDOS (REMOVER DO CÓDIGO):
- `AGUARDANDO_DESPACHO` → Usar `PENDENTE_ENTREGA`
- `ATRIBUIDA` → Remover
- `ACEITA` → Remover
- `ENTREGUE` → Usar `CONCLUIDA`
- `FALHA_DEVOLVIDA` → Usar `DEVOLVIDA`

**TypeScript (ÚNICA definição válida):**
```typescript
export type DeliveryStatus = 
  | 'CRIADA'
  | 'PENDENTE_ENTREGA'
  | 'EM_ROTA'
  | 'CONCLUIDA'
  | 'DEVOLVIDA'
  | 'CANCELADA';
```

---

## 8. ENTIDADES PRINCIPAIS

### 8.1 DEPOSITS (Depósitos)
```typescript
interface Deposit {
  id: string;           // UUID
  nome: string;         // Nome do depósito
  endereco?: string;    // Endereço físico
  ativo: boolean;       // Ativo/Inativo
  cor?: string;         // Cor para UI
}
```

### 8.2 PRODUCTS (Produtos)
```typescript
interface Product {
  id: string;
  codigo: string;                    // SKU/Código interno
  nome: string;
  tipo: 'GAS_CHEIO' | 'VASILHAME_VAZIO' | 'AGUA' | 'OUTROS';
  movement_type: 'SIMPLE' | 'EXCHANGE' | 'FULL';
  return_product_id?: string | null; // Vínculo com produto vazio (se EXCHANGE)
  track_stock: boolean;              // Controla estoque?
  ativo: boolean;
  
  // Preços
  preco_venda: number;               // Preço padrão (fallback)
  preco_custo: number;               // Custo de aquisição
  preco_troca?: number | null;       // Preço quando TROCA (cliente devolve casco)
  preco_completa?: number | null;    // Preço quando COMPLETA (cliente leva casco)
}
```

### 8.3 EMPLOYEES (Colaboradores)
```typescript
interface Colaborador {
  id: string;
  nome: string;
  cargo: 'GERENTE' | 'ENTREGADOR' | 'ATENDENTE' | 'CAIXA';
  depositoId: string | null;  // null = acesso global
  ativo: boolean;
  username: string;
  password: string;
  permissoes: string[];
}
```

**Regras de Acesso por Cargo:**
| Cargo | depositoId | Acesso |
|-------|------------|--------|
| GERENTE | `null` | Todos os depósitos |
| ENTREGADOR | `null` | Todos os depósitos |
| ATENDENTE | obrigatório | Apenas seu depósito |
| CAIXA | obrigatório | Apenas seu depósito |

### 8.4 SERVICE_ORDERS (Ordens de Serviço)
```typescript
interface OrdemServico {
  id: string;
  numeroOs: string;
  depositoId: string;
  
  // Cliente
  clienteId: string;
  clienteNome: string;
  clienteTelefone?: string;
  enderecoEntrega?: string;
  
  // Tipo e Status
  tipoAtendimento: 'BALCAO' | 'DELIVERY';  // ⚠️ APENAS ESTES 2
  status: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA';
  statusEntrega?: DeliveryStatus;
  
  // Itens e Valores
  itens: ItemOrdemServico[];
  pagamentos: PagamentoOrdemServico[];
  total: number;
  delivery_fee: number;  // Taxa de entrega (0 se BALCAO)
  
  // Timestamps
  dataHoraCriacao: number;
  dataHoraConclusao?: number;
  updated_at: number;
}

// ⚠️ IMPORTANTE: ItemOrdemServico com sale_movement_type
interface ItemOrdemServico {
  id: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  modalidade: string;                              // 'VENDA', 'SERVICO', etc.
  
  /**
   * Modo de venda ESCOLHIDO no momento da venda.
   * - 'EXCHANGE': cliente devolveu casco → entra vazio no estoque
   * - 'FULL': cliente levou casco → NÃO entra vazio
   * - null: usa o movement_type do produto como fallback
   */
  sale_movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null;
}
```

### 8.5 WORK_SHIFTS (Turnos de Caixa)
```typescript
interface WorkShift {
  id: string;
  depositoId: string;
  user_id: string;
  status: 'OPEN' | 'CLOSED' | 'DISCREPANCY';
  opened_at: number;
  closed_at?: number;
  opening_balance: number;
  closing_balance?: number;
  declared_cash?: number;
  declared_card?: number;
  declared_pix?: number;
  system_cash?: number;
  system_card?: number;
  system_pix?: number;
}
```

**Regras de Turno:**
1. Um operador **NUNCA** pode ter mais de um turno aberto
2. Turno fecha **apenas manualmente**
3. Se houver discrepância: **avisa** mas **permite fechar**

---

## 9. FORMAS DE PAGAMENTO

| Tipo | Código | Gera Contas a Receber? |
|------|--------|------------------------|
| Dinheiro | `cash` | ❌ Não |
| Cartão | `card` | ❌ Não |
| PIX | `pix` | ❌ Não (sempre à vista) |
| Fiado | `fiado` | ✅ Sim |
| Boleto | `boleto` | ✅ Sim (manual) |
| Outros | `other` | Configurável |

---

## 10. CÁLCULO DE ESTOQUE

### Regra de Ouro
> **NUNCA** armazene saldo em um campo fixo. O saldo é **sempre calculado**.

```sql
SELECT SUM(quantity) as saldo
FROM stock_movements
WHERE product_id = :productId AND deposit_id = :depositId;
```

### Tipos de Movimento
| Tipo | Código | Efeito |
|------|--------|--------|
| Venda | `SALE` | Negativo (-) |
| Compra | `PURCHASE` | Positivo (+) |
| Troca (entrada vazio) | `TRADE_IN` | Positivo (+) |
| Perda | `LOSS` | Negativo (-) |
| Ajuste | `ADJUSTMENT` | +/- |
| Transferência saída | `TRANSFER_OUT` | Negativo (-) |
| Transferência entrada | `TRANSFER_IN` | Positivo (+) |

---

## 11. DESPESAS (CONTAS A PAGAR)

```typescript
interface Expense {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  category: 'FIXA' | 'VARIAVEL' | 'SALARIO';
  depositoId?: string;
  alert_days_before: number;  // Dias antes para alertar
}
```

---

## 12. REGRAS DE DESENVOLVIMENTO

### 12.1 TypeScript
- **NUNCA use `any`**
- Campos em **camelCase** no frontend
- Campos em **snake_case** no Supabase
- Use os tipos de `src/types/supabase.ts`

### 12.2 Imports
```typescript
// ✅ Use o alias @
import { depositService } from '@/services';
import type { Deposit } from '@/services';

// ❌ Evite caminhos relativos longos
import { depositService } from '../../../src/services';
```

### 12.3 Services (v3.0 - Online-Only)
- **Toda operação passa por `src/services/`**
- Services chamam **DIRETAMENTE** o Supabase
- **Nunca** chame `supabase.from()` diretamente de componentes
- **Nunca** armazene dados no navegador (LocalStorage, IndexedDB, etc.)

```typescript
// ✅ CORRETO (v3.0)
import { depositService } from '@/services';
const deposits = await depositService.getAll();

// ❌ PROIBIDO
const { data } = await supabase.from('deposits').select('*');
localStorage.setItem('deposits', JSON.stringify(data)); // NUNCA FAZER ISSO
```

---

## 13. CHECKLIST PARA NOVAS FUNCIONALIDADES

### Regras de Negócio:
- [ ] Usa apenas `BALCAO` ou `DELIVERY`?
- [ ] `movement_type` correto (`SIMPLE`, `EXCHANGE`, `FULL`)?
- [ ] Produto EXCHANGE tem `preco_troca` e `preco_completa` configurados?
- [ ] Produto EXCHANGE tem `return_product_id` vinculado ao vazio?
- [ ] Item da O.S. salva `sale_movement_type` quando aplicável?
- [ ] Preços vêm de `product_pricing` ou dos campos específicos?
- [ ] Taxa de entrega no campo `delivery_fee`?
- [ ] IDs são UUID v4?

### Arquitetura (v3.0 - Online-Only):
- [ ] **Usa Services** (nunca chama Supabase direto de componentes)?
- [ ] **Trata erros de rede** com try/catch e feedback visual?
- [ ] **NÃO armazena dados localmente** (zero LocalStorage/IndexedDB)?
- [ ] **Mostra loading** enquanto aguarda resposta do servidor?
- [ ] Sem `any` no TypeScript?

---

## 14. FLUXO VISUAL: VENDA COM ESCOLHA DE MODALIDADE

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE VENDA DE GÁS                        │
└─────────────────────────────────────────────────────────────────┘

1. Operador clica em "Gás P13" (movement_type = EXCHANGE)
                    │
                    ▼
2. Sistema abre modal: "TROCA ou COMPLETA?"
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   🔁 TROCA                📦 COMPLETA
   R$ 130,00               R$ 220,00
        │                       │
        ▼                       ▼
3. Item adicionado         Item adicionado
   sale_movement_type      sale_movement_type
   = 'EXCHANGE'            = 'FULL'
        │                       │
        └───────────┬───────────┘
                    ▼
4. O.S. Concluída
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Estoque:                Estoque:
   -1 Cheio                -1 Cheio
   +1 Vazio                (sem entrada de vazio)
```

---

## 15. SCHEMA DO SUPABASE (40 TABELAS)

> ⚠️ **IMPORTANTE:** O Supabase usa nomes em **INGLÊS** (snake_case). O frontend usa **PORTUGUÊS** (camelCase).  
> A conversão é feita pelo `dataSanitizer.ts` (PT→EN para envio, EN→PT para recebimento).

### 15.1 Tabelas Principais

| # | Tabela | Descrição | Arquivo de Referência |
|---|--------|-----------|----------------------|
| 1 | `deposits` | Depósitos/Lojas | `src/domain/db.ts` |
| 2 | `products` | Produtos (gás, água, vasilhames) | `src/domain/db.ts` |
| 3 | `employees` | Colaboradores | `src/domain/db.ts` |
| 4 | `clients` | Clientes | `src/domain/db.ts` |
| 5 | `payment_methods` | Formas de Pagamento | `src/domain/db.ts` |
| 6 | `service_orders` | Ordens de Serviço (vendas) | `src/domain/db.ts` |
| 7 | `service_order_items` | Itens da OS | `src/domain/db.ts` |
| 8 | `service_order_payments` | Pagamentos da OS | `src/domain/db.ts` |

### 15.2 Tabelas de Estoque

| # | Tabela | Descrição |
|---|--------|-----------|
| 9 | `stock_balance` | Saldo de Estoque (cache) |
| 10 | `stock_movements` | Movimentações de Estoque |
| 11 | `stock_transfers` | Transferências entre Depósitos |
| 12 | `stock_transfer_items` | Itens de Transferência |
| 13 | `stock_counts` | Contagens de Estoque |
| 14 | `stock_count_items` | Itens da Contagem |

### 15.3 Tabelas Financeiras

| # | Tabela | Descrição |
|---|--------|-----------|
| 15 | `accounts_receivable` | Contas a Receber |
| 16 | `receivable_payments` | Pagamentos de Recebíveis |
| 17 | `expenses` | Despesas/Contas a Pagar |
| 18 | `work_shifts` | Turnos de Trabalho/Caixa |
| 19 | `cash_flow_entries` | Lançamentos de Caixa |
| 20 | `shift_stock_audits` | Auditoria de Estoque/Turno |

### 15.4 Tabelas de Delivery

| # | Tabela | Descrição |
|---|--------|-----------|
| 21 | `delivery_zones` | Zonas de Entrega (globais) |
| 22 | `delivery_sectors` | Setores/Bairros das Zonas |
| 23 | `zone_pricing` | Taxa de Entrega por Zona/Depósito |
| 28 | `delivery_jobs` | Jobs de Entrega |
| 29 | `driver_presence` | Presença de Entregadores |

### 15.5 Tabelas de Precificação

| # | Tabela | Descrição |
|---|--------|-----------|
| 24 | `product_pricing` | Preço do Produto por Depósito |
| 25 | `product_exchange_rules` | Regras de Troca (Cheio↔Vazio) |
| 26 | `client_price_overrides` | Preços Especiais por Cliente |
| 27 | `client_one_time_benefits` | Descontos Únicos |

### 15.6 Tabelas Auxiliares

| # | Tabela | Descrição |
|---|--------|-----------|
| 30 | `machines` | Maquininhas de Cartão |
| 36 | `audit_logs` | Logs de Auditoria |
| 37 | `financial_settings` | Configurações Financeiras |
| 38 | `outbox_events` | Fila de Sincronização |
| 39 | `boletos` | Boletos Bancários |
| 40 | `kv` | Key-Value Store (configurações) |

### 15.7 Tabelas Legado (Manter Compatibilidade)

| # | Tabela | Descrição | Preferir Usar |
|---|--------|-----------|---------------|
| 31 | `price_table` | Tabela de Preços | `product_pricing` |
| 32 | `cash_sessions` | Sessões de Caixa | `work_shifts` |
| 33 | `cash_movements` | Movimentos de Caixa | `cash_flow_entries` |
| 34 | `financial_movements` | Movimentos Financeiros | `cash_flow_entries` |
| 35 | `receivable_titles` | Títulos a Receber | `accounts_receivable` |

---

## 16. MAPEAMENTO DE CAMPOS (PT → EN)

### 16.1 Campos Universais

| Frontend (PT) | Supabase (EN) |
|---------------|---------------|
| `id` | `id` |
| `depositoId` | `deposit_id` |
| `nome` | `name` |
| `ativo` | `is_active` / `active` |
| `endereco` | `address` |
| `telefone` | `phone` |
| `dataHora` | `created_at` |

### 16.2 Produtos

| Frontend (PT) | Supabase (EN) |
|---------------|---------------|
| `preco_venda` | `sale_price` |
| `preco_custo` | `cost_price` |
| `preco_troca` | `exchange_price` |
| `preco_completa` | `full_price` |
| `movimento_tipo` | `movement_type` |
| `return_product_id` | `return_product_id` |

### 16.3 Stock Movements

| Frontend (PT) | Supabase (EN) |
|---------------|---------------|
| `produtoId` | `product_id` |
| `quantidade` | `quantity` |
| `tipo` | `origin` (guarda tipo original) |
| `motivo` | `reason` |
| - | `type` (IN/OUT) |

### 16.4 Service Orders

| Frontend (PT) | Supabase (EN) |
|---------------|---------------|
| `clienteId` | `client_id` |
| `clienteNome` | `client_name` |
| `entregadorId` | `driver_id` |
| `enderecoEntrega` | `delivery_address` |
| `tipoAtendimento` | `service_type` |
| `numeroOs` | `order_number` |
| `valorTotal` | `total` |

---

## 17. HOSPEDAGEM E DEPLOYMENT

### 17.1 Arquitetura de Hospedagem

```
┌─────────────────────────────────────────────────┐
│  USUÁRIO (Entregador/Gerente)                  │
└────────────────┬────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────┐
│  VERCEL (Frontend)                              │
│  - React build (HTML/CSS/JS)                    │
│  - URL: seuerp.vercel.app                       │
└────────────────┬────────────────────────────────┘
                 │ API Calls
                 ▼
┌─────────────────────────────────────────────────┐
│  SUPABASE (Backend)                             │
│  - PostgreSQL (40 tabelas)                      │
│  - Autenticação                                 │
│  - RLS (Row Level Security)                     │
└─────────────────────────────────────────────────┘
```

### 17.2 Deploy no Vercel

**Configuração (.env.production):**
```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

**Comandos:**
```bash
# Build de produção
npm run build

# Deploy (automático via Git)
git push origin main  # Vercel detecta e deploya
```

**Configurações Vercel:**
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Framework Preset:** Vite

### 17.3 Configuração do Supabase

1. **Allowed URLs (Authentication → URL Configuration):**
   ```
   https://seuerp.vercel.app
   http://localhost:5173  # para dev local
   ```

2. **CORS Policy (API Settings):**
   - Liberar domínio Vercel

3. **Environment Variables (no Vercel Dashboard):**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 18. ARQUIVOS PRINCIPAIS DO PROJETO

### 18.1 Estrutura de Pastas (v3.0 - Online-Only)

```
src/
├── types/
│   └── supabase.ts              # Tipos das 40 tabelas (Database interface)
├── services/
│   ├── depositService.ts        # CRUD de depósitos
│   ├── productService.ts        # CRUD de produtos + pricing
│   ├── stockService.ts          # Estoque (direto no Supabase)
│   ├── serviceOrderService.ts   # Vendas (transações atômicas)
│   ├── clientService.ts         # CRUD de clientes
│   ├── financialService.ts      # Caixa + contas a receber/pagar
│   ├── deliveryService.ts       # Zonas + entregadores
│   ├── index.ts                 # Barrel export
│   └── README.md                # Documentação dos serviços
├── components/
│   ├── NewServiceOrder.tsx      # Tela de Nova OS (PDV)
│   ├── DepositsStockModule.tsx  # Gestão de Estoque
│   └── ...
├── contexts/
│   └── ShiftContext.tsx         # Contexto do turno atual
└── utils/
    └── supabaseClient.ts        # Cliente Supabase (singleton)
```

**🗑️ REMOVIDOS (v3.0):**
- ❌ `src/domain/db.ts` (Dexie/IndexedDB)
- ❌ `src/domain/sync/` (toda pasta de sincronização)
- ❌ `src/domain/repositories/` (repositórios locais)
- ❌ `outbox_events` (tabela de fila)

### 18.2 Arquivos Críticos (v3.0 - Online-Only)

| Arquivo | Função |
|---------|--------|
| `src/types/supabase.ts` | Tipos das 40 tabelas (Row, Insert, Update) |
| `src/services/depositService.ts` | CRUD depósitos (direto no Supabase) |
| `src/services/productService.ts` | CRUD produtos + pricing lógica |
| `src/services/stockService.ts` | Estoque + movimentos (cálculo em tempo real) |
| `src/services/serviceOrderService.ts` | Vendas atômicas (order + items + stock) |
| `src/services/financialService.ts` | Caixa + contas a receber/pagar |
| `src/services/deliveryService.ts` | Entregas + zonas + entregadores |
| `components/NewServiceOrder.tsx` | PDV + modal TROCA/COMPLETA |
| `components/DepositsStockModule.tsx` | Gestão de estoque + carga inicial |

**🗑️ ARQUIVOS REMOVIDOS:**
- ❌ `src/domain/db.ts` (Dexie)
- ❌ `src/domain/sync/syncService.ts`
- ❌ `src/domain/sync/outbox.ts`
- ❌ `src/domain/repositories/*.repo.ts`

---

## 19. STATUS ATUAL DO PROJETO (06/01/2026)

### 🎯 MIGRAÇÃO PARA v3.0 - ONLINE REAL-TIME

**📅 Data:** 06/01/2026  
**🔄 Status:** Arquitetura redefinida - Em processo de migração

### ✅ Funcionalidades Mantidas (Regras de Negócio)

1. **Sistema de Tipos de Atendimento** - BALCAO e DELIVERY apenas
2. **Modal TROCA/COMPLETA** - Escolha de modalidade na venda
3. **Preços por Modalidade** - `exchange_price` e `full_price` no produto
4. **sale_movement_type** - Campo no item da OS para rastrear escolha
5. **Cálculo de Estoque em Tempo Real** - SUM(quantity) direto no Supabase
6. **Multi-depósito** - Preços e estoque por depósito

### 🔄 Mudanças Estruturais (v3.0)

**REMOVIDO:**
- ❌ Dexie.js (IndexedDB)
- ❌ `src/domain/sync/` (sincronização)
- ❌ `src/domain/repositories/` (repositórios locais)
- ❌ `outbox_events` (fila de sincronização)
- ❌ Offline-first (cache local)

**ADICIONADO:**
- ✅ Conexão direta Supabase via Services
- ✅ Tratamento de erros de rede (feedback imediato)
- ✅ Arquitetura simplificada (Client-Server)
- ✅ Documentação de deploy Vercel + Supabase

### ⚠️ Próximos Passos (Migração v2.1 → v3.0)

1. **Remover dependências antigas:**
   ```bash
   npm uninstall dexie dexie-react-hooks
   ```

2. **Atualizar Services** (já criados em v3.0):
   - Verificar que todos chamam Supabase direto
   - Remover qualquer referência a Dexie

3. **Migrar Componentes:**
   - Substituir chamadas a repositórios locais por Services
   - Adicionar tratamento de erros de rede
   - Remover lógica de sincronização

4. **Remover Tabela `outbox_events` do Supabase:**
   ```sql
   DROP TABLE IF EXISTS outbox_events CASCADE;
   ```

5. **Configurar Deploy:**
   - Criar projeto no Vercel
   - Configurar variáveis de ambiente
   - Testar build de produção

---

## 20. COMO CONTINUAR O DESENVOLVIMENTO (v3.0)

### 20.1 Antes de Qualquer Alteração

1. **Leia este documento** completamente
2. **Verifique os tipos** em `src/types/supabase.ts`
3. **Entenda a arquitetura Online-Only** (React → Services → Supabase direto)
4. **NUNCA armazene dados no navegador** (zero LocalStorage/IndexedDB)

### 20.2 Para Adicionar Nova Funcionalidade

1. **Definir tipos** em `src/types/supabase.ts` (tabela no Database interface)
2. **Criar/Atualizar Service** em `src/services/`:
   ```typescript
   // Exemplo: userService.ts
   export const userService = {
     async getAll() {
       const { data, error } = await supabase.from('users').select('*');
       if (error) throw error;
       return data;
     },
     // ... outros métodos
   };
   ```
3. **Criar migração SQL** em `supabase/migrations/`
4. **Atualizar componente** para usar o Service:
   ```typescript
   import { userService } from '@/services';
   
   try {
     const users = await userService.getAll();
     setUsers(users);
   } catch (err) {
     showError('Erro ao carregar usuários');
   }
   ```

### 20.3 Para Debugar Erros de Conexão

```typescript
// Verificar status da conexão Supabase
const { data, error } = await supabase.from('deposits').select('count');
if (error) {
  console.error('Supabase offline:', error.message);
  alert('Sem conexão com o servidor. Verifique sua internet.');
}
```

### 20.4 Boas Práticas (v3.0)

**✅ FAZER:**
- Usar Services para toda operação de dados
- Tratar erros com try/catch
- Mostrar loading enquanto aguarda resposta
- Dar feedback claro ao usuário (sucesso/erro)
- Validar dados ANTES de enviar ao servidor

**❌ NÃO FAZER:**
- Chamar `supabase.from()` direto de componentes
- Armazenar dados em LocalStorage/IndexedDB
- Assumir que a requisição sempre vai funcionar
- Esconder erros de conexão do usuário

---

## 21. DIFERENÇAS: v2.1 (Offline) vs v3.0 (Online)

| Aspecto | v2.1 (Offline-First) | v3.0 (Online-Only) |
|---------|----------------------|--------------------|
| **Banco Local** | Dexie (IndexedDB) | ❌ Nenhum |
| **Sincronização** | Outbox + syncService | ❌ Não existe |
| **Quando salva** | 1. Dexie → 2. Fila → 3. Supabase (depois) | Supabase (imediato) |
| **Sem internet** | Funciona (salva local) | ❌ Mostra erro |
| **Risco de perda** | Alto (dados presos no cache) | Zero (ou salva ou não) |
| **Complexidade** | Extrema | Mínima |
| **Código** | 3 camadas (UI → Repo → Sync → Supabase) | 2 camadas (UI → Service → Supabase) |
| **Hospedagem** | Google IDX (dev) | Vercel (produção) |

### 21.1 Exemplo de Código: Criar Depósito

**v2.1 (Offline):**
```typescript
// ❌ Complexo (3 etapas)
1. await db.deposits.add(deposit);      // Grava no Dexie
2. await db.outbox_events.add({...});   // Enfileira
3. await syncService.processQueue();     // Sincroniza (se online)
```

**v3.0 (Online):**
```typescript
// ✅ Simples (1 etapa)
try {
  const deposit = await depositService.create({ name: 'Filial Centro' });
  showSuccess('Depósito criado!');
} catch (err) {
  showError('Erro de conexão. Tente novamente.');
}
```

---

**Versão:** 3.0 - ONLINE REAL-TIME  
**Última atualização:** 06/01/2026  
**Mudança Crítica:** Migrado de Offline-First (v2.1) para Online-Only (v3.0)