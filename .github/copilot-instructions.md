✅ INSTRUÇÕES CANÔNICAS PARA AI AGENTS (v3.1)
# ERP Distribuidora de Gás - Instruções para AI Agents

> **v3.1 Online Real-Time (SSOT)** | React 19 + TypeScript + Vite + Supabase + Tailwind

## 0) Arquitetura Principal



React Components → src/services/*.ts → Supabase (PostgreSQL via PostgREST)


### Regras absolutas
- **NUNCA** chame `supabase.from()` em componentes — sempre use services em `src/services/`.
- **NUNCA** armazene dados de negócio no navegador (zero localStorage/IndexedDB/Dexie).
- **SEMPRE** trate erros com `try/catch` + `toast` (`sonner`).
- **SEMPRE** respeite o schema do Supabase: **não inventar colunas**.

Exemplo:

```ts
// ✅ CORRETO
import { depositService } from '@/services';
const deposits = await depositService.getAll();

// ❌ PROIBIDO
const { data } = await supabase.from('deposits').select('*');

1) Fonte única da verdade

O schema do Supabase (public) é a única fonte da verdade.

Se um campo/coluna não existir no schema:

✅ ajustar o frontend ao schema real OU

✅ propor migration SQL explícita (com script idempotente)

❌ nunca inventar coluna/campo no código

2) Tipos TypeScript (obrigatório)

Fonte da verdade: src/types/supabase.ts (gerado via Supabase CLI).

Para cada tabela, tipar usando somente:

Database['public']['Tables']['<table>']['Row' | 'Insert' | 'Update']


❌ Proibido criar interface manual duplicando schema.

❌ Proibido usar any.

3) Query style (anti-erros PostgREST)

Em módulos críticos, evitar select('*').

Preferir constantes de campos canônicos por tabela (string).

Exemplo:

export const PAYMENT_METHOD_FIELDS =
  'id,name,method_kind,receipt_type,generates_receivable,is_active,created_at,updated_at' as const;

.single() vs .maybeSingle()

Use .single() apenas quando a query é por PK ou unique garantido.

Para config opcional, use .maybeSingle() + fallback.

4) Estrutura de Services (contrato do projeto)

Todos acessos ao Supabase devem existir em src/services/*.

Serviço	Responsabilidade
depositService	Depósitos/lojas
productService	Produtos + precificação
stockService	Estoque (saldo calculado/consultado)
serviceOrderService	Vendas atômicas (OS + itens + pagamentos + estoque)
clientService	Clientes
employeeService	Colaboradores/usuários
financialService	Caixa + contas a pagar/receber
deliveryService	Zonas/entregas
5) Conceitos de Negócio Críticos
5.1 Tipos de Atendimento (APENAS 2)
type TipoAtendimento = 'BALCAO' | 'DELIVERY';

5.2 Estoque: tipos de venda
Tipo	Descrição	Estoque
SIMPLE	Venda normal	SAÍDA
EXCHANGE	Troca vasilhame	SAÍDA cheio + ENTRADA vazio
FULL	Venda completa (cliente novo)	SAÍDA (sem retorno)
5.3 Preços por Modalidade (movement_type = 'EXCHANGE')

sale_price → preço padrão

exchange_price → preço troca (devolve casco)

full_price → preço completo (leva casco)

6) Formas de Pagamento (modelo canônico)
6.1 Duas dimensões obrigatórias

Dimensão A — Liquidação (apenas 2)

payment_methods.receipt_type (text, contrato do app)

IMMEDIATE = À vista

DEFERRED = A prazo

Dimensão B — Categoria do meio de pagamento

payment_methods.method_kind (text, contrato do app)

CASH | PIX | CARD | FIADO | BOLETO | VALE | OTHER

Nome exibido

payment_methods.name é o rótulo (ex.: "Pix Nubank", "Vale Mercado X")

6.2 Tabela payment_methods (campos canônicos)

id uuid (PK)

name text (NOT NULL)

method_kind text (NOT NULL) ✅ (nova coluna do modelo)

receipt_type text (nullable)

generates_receivable boolean (nullable)

is_active boolean (nullable) ✅ usar para ativar/desativar globalmente

created_at, updated_at

❌ Campos proibidos (não existem / não usar):

default_due_days

type

ativo

machine_label (não pertence a payment_methods)

6.3 Configuração por Depósito (prazo + ativação local)

Tabela: payment_method_deposit_config

payment_method_id (FK payment_methods)

deposit_id (FK deposits)

is_active boolean (ativar/desativar no depósito)

due_days integer (prazo em dias) ✅ obrigatório para DEFERRED

unique(payment_method_id, deposit_id)

Regras:

Se receipt_type = IMMEDIATE:

generates_receivable deve ser sempre false

due_days deve ser 0

Se receipt_type = DEFERRED:

due_days > 0 (validar no frontend)

se generates_receivable = true, criar conta a receber na finalização da venda com vencimento = hoje + due_days

6.4 Máquinas de cartão

Cadastro/gestão de máquinas: tabela machines

Pagamento na venda: service_order_payments.machine_id / machine_name

Não adicionar campos de máquina em payment_methods

7) Regra operacional: toda forma deve movimentar registros

Toda venda registra pagamentos em service_order_payments usando:

payment_method_id (uuid) sempre que possível

payment_method_name como snapshot

Para caixa/financeiro/recebíveis:

Preferir colunas *_id quando existirem

Quando a tabela tiver apenas texto (ex.: cash_flow_entries.payment_method), preencher com payment_method_name snapshot

Contas a receber: usar somente accounts_receivable

receivables, receivable_titles, receivable_payments são legadas e proibidas no app (até serem removidas do DB)

8) Comandos de desenvolvimento
npm run dev
npm run build
npm run test
npm run validate

9) Deploy

Frontend: Vercel (auto deploy via GitHub)

Backend: Supabase

ENV: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY