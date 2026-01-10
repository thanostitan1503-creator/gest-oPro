ERP Distribuidora de Gás - Instruções para AI Agents

v3.2 Online Real-Time (SSOT) | React 19 + TypeScript + Vite + Supabase + Tailwind
v3.2: preços por modalidade canônicos em product_pricing + pricing_mode enum

0) Arquitetura Principal

Fluxo de dados

React Components → src/services/*.ts → Supabase (PostgreSQL via PostgREST)

Regras absolutas

NUNCA chamar supabase.from() direto em componentes — sempre usar services em src/services/.

NUNCA armazenar dado de negócio no navegador (nada de localStorage / IndexedDB / Dexie como fonte de verdade).

Cache local/temporário só via camada db/helpers já existente, sem criar novas stores nem novos campos.

SEMPRE tratar erros com try/catch + toast (sonner).

SEMPRE respeitar o schema do Supabase: não inventar colunas.

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

❌ nunca inventar coluna/campo no código.

2) Tipos TypeScript (obrigatório)

Fonte da verdade: src/types/supabase.ts (gerado via Supabase CLI).

Para cada tabela, tipar usando somente:

Database['public']['Tables']['<table>']['Row' | 'Insert' | 'Update']


Para enums do banco (ex.: pricing_mode), usar:

Database['public']['Enums']['pricing_mode'] ou

tipos de domínio já expostos (ex.: PricingMode em @/domain/types).

❌ Proibido criar interface manual duplicando schema.
❌ Proibido usar any em camada de serviço/modelo (aceitável só em bordas muito específicas, nunca em contrato principal).

3) Query style (anti-erros PostgREST)

Em módulos críticos, evitar select('*').

Preferir constantes de campos canônicos por tabela (string).

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
4.1. Precificação (APENAS via productService)

Leitura de preço: usar sempre os helpers canônicos:

resolvePrice(...) em @/utils/pricing

métodos de productService (getPricing, listPricingByProduct, etc.)

Gravação / remoção de preço:

productService.setPricing(...)

productService.removePricing(...)

Componentes não podem fazer supabase.from('product_pricing') direto.

5) Conceitos de Negócio Críticos
5.1 Tipos de Atendimento (APENAS 2)
type TipoAtendimento = 'BALCAO' | 'DELIVERY';

5.2 Estoque: tipos de venda (movement_type)

Campo de produto: products.movement_type

Tipo	Descrição	Estoque
SIMPLE	Venda normal	SAÍDA
EXCHANGE	Troca vasilhame	SAÍDA cheio + ENTRADA vazio
FULL	Venda completa (cliente novo, leva casco)	SAÍDA (sem retorno, não entra vasilhame vazio)
5.3 Preços por Modalidade (modelo CANÔNICO v3.2)
5.3.1. Enum de modalidade

Enum do banco: public.pricing_mode
Valores canônicos:

type PricingMode = 'SIMPLES' | 'TROCA' | 'COMPLETA';


Normalização:

SIMPLES ↔ venda simples / fallback

TROCA ↔ troca (cliente devolve casco)

COMPLETA↔ venda completa (cliente leva casco novo)

5.3.2. Tabela canônica de preço: product_pricing

Toda lógica nova de preço deve usar esta tabela.

Campos canônicos (simplificado):

id uuid (PK)

product_id uuid (FK products.id)

deposit_id uuid (FK deposits.id)

pode ser NULL apenas para preço global legado / fallback, não para features novas.

mode pricing_mode NOT NULL DEFAULT 'SIMPLES'

price numeric(10,2) (preço efetivo da modalidade)

Regras de unicidade:

UNIQUE (product_id, deposit_id, mode)


Ou seja: para cada par (produto, depósito) pode existir no máximo 1 preço por modalidade.

5.3.3. Campos legados em products (somente leitura)

A tabela products ainda possui:

sale_price → preço padrão (histórico)

exchange_price → preço troca (histórico)

full_price → preço completa (histórico)

Regras:

Esses campos são LEGADO / FALLBACK.

✅ Podem ser lidos para cálculo de margem ou migração.

❌ Não usar esses campos como fonte principal de preço em features novas.

❌ Não criar lógica nova de gravação direta nesses campos; use product_pricing.

5.3.4. Mapeamento movement_type → pricing_mode

Para resolver o preço de venda, o mapeamento hierárquico é:

Produto movement_type = 'EXCHANGE':

venda troca → pricing_mode = 'TROCA'

venda completa → pricing_mode = 'COMPLETA'

Produto movement_type = 'FULL':

sempre usar pricing_mode = 'COMPLETA'

Produto movement_type = 'SIMPLE' (ou outros casos):

usar pricing_mode = 'SIMPLES'

Sempre que possível:

Chamar resolvePrice({ productId, depositId, mode, rows })

rows deve vir de productService.listPricingByProduct(productId).

O helper já trata:

fallback para deposit_id IS NULL (preço global) quando não existir preço específico de depósito;

migração de dados legados (exchange_price/full_price) para o modelo novo.

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

payment_methods.name é o rótulo (ex.: "Pix Nubank", "Vale Mercado X").

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

Campos:

payment_method_id (FK payment_methods)

deposit_id (FK deposits)

is_active boolean (ativar/desativar no depósito)

due_days integer (prazo em dias) ✅ obrigatório para DEFERRED

Regra de unicidade:

UNIQUE (payment_method_id, deposit_id)


Regras de negócio:

Se receipt_type = 'IMMEDIATE':

generates_receivable deve ser sempre false

due_days deve ser 0

Se receipt_type = 'DEFERRED':

due_days > 0 (validar no frontend)

se generates_receivable = true, criar conta a receber na finalização da venda com:

vencimento = hoje + due_days

6.4 Máquinas de cartão

Cadastro/gestão de máquinas: tabela machines

Pagamento na venda: service_order_payments.machine_id / machine_name

❌ Não adicionar campos de máquina em payment_methods.

7) Regra operacional: toda forma deve movimentar registros

Toda venda registra pagamentos em service_order_payments usando:

payment_method_id (uuid) sempre que possível

payment_method_name como snapshot

Para caixa/financeiro/recebíveis:

Preferir colunas *_id quando existirem.

Quando a tabela tiver apenas texto (ex.: cash_flow_entries.payment_method), preencher com payment_method_name snapshot.

Contas a receber

Usar somente accounts_receivable.

Tabelas receivables, receivable_titles, receivable_payments são legadas e proibidas no app (até serem removidas do DB).

8) Comandos de desenvolvimento

npm run dev

npm run build

npm run test

npm run validate

9) Deploy

Frontend: Vercel (auto deploy via GitHub)

Backend: Supabase

Variáveis de ambiente:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY