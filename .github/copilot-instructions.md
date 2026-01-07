# ERP Distribuidora de Gás - Instruções para AI Agents

> **v3.0 Online Real-Time** | React 19 + TypeScript + Vite + Supabase + Tailwind

## Arquitetura Principal

```
React Components → src/services/*.ts → Supabase (PostgreSQL direto)
```

**Regras absolutas:**
- **NUNCA** chame `supabase.from()` em componentes - sempre use services em `src/services/`
- **NUNCA** armazene dados no navegador (zero localStorage/IndexedDB)
- **SEMPRE** trate erros com try/catch + toast visual (`sonner`)

```typescript
// ✅ CORRETO
import { depositService } from '@/services';
const deposits = await depositService.getAll();

// ❌ PROIBIDO
const { data } = await supabase.from('deposits').select('*');
```

## Estrutura de Serviços

| Serviço | Responsabilidade |
|---------|------------------|
| `depositService` | Depósitos/lojas |
| `productService` | Produtos + preços por modalidade |
| `stockService` | Estoque (saldo calculado via SUM) |
| `serviceOrderService` | Vendas atômicas (OS + itens + estoque) |
| `clientService` | Clientes |
| `employeeService` | Colaboradores/usuários |
| `financialService` | Caixa, contas a pagar/receber |
| `deliveryService` | Zonas, setores, entregadores |

## Tipos TypeScript

- **Fonte da verdade:** `src/types/supabase.ts` (40 tabelas tipadas)
- **Supabase usa inglês (snake_case):** `deposit_id`, `is_active`, `sale_price`
- **Frontend usa português (camelCase):** `depositoId`, `ativo`, `precoVenda`
- **NUNCA** use `any` - sempre tipar com `Database['public']['Tables']['nome']['Row']`

## Conceitos de Negócio Críticos

### Tipos de Atendimento (APENAS 2)
```typescript
type TipoAtendimento = 'BALCAO' | 'DELIVERY'; // ÚNICO válido
```

### Formas de Pagamento (Payment Methods)
- Tabela: `payment_methods`.
- Campos canônicos: `id` (UUID), `name`, `receipt_type` (`'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other'`), `generates_receivable` (boolean), `machine_label` opcional, `created_at`/`updated_at`.
- **Campos removidos**: `default_due_days`, `type`, `is_active` – não usar.
- Regras de negócio do modal:
  - Para `cash` e `pix`, `generates_receivable` deve ser sempre `false` (checkbox desabilitado).
  - Para `card`, `fiado`, `boleto`, `other`, o usuário escolhe se gera conta a receber.
  - `machine_label` é apenas rótulo livre (ex.: “Stone-01”), opcional.
- Sempre persistir via service/util existente (ex.: `payment_methods` em `services`/helpers), nunca direto no componente.

### Tipos de Movimento de Estoque
| Tipo | Descrição | Estoque |
|------|-----------|---------|
| `SIMPLE` | Venda normal | Só SAÍDA |
| `EXCHANGE` | Troca vasilhame | SAÍDA cheio + ENTRADA vazio |
| `FULL` | Venda completa (cliente novo) | Só SAÍDA (sem retorno) |

### Preços por Modalidade (produtos com `movement_type = 'EXCHANGE'`)
- `sale_price` → Preço padrão
- `exchange_price` → Preço na TROCA (cliente devolve casco)
- `full_price` → Preço COMPLETO (cliente leva casco)

## Comandos de Desenvolvimento

```bash
npm run dev          # Iniciar dev server (Vite)
npm run build        # Build para produção
npm run test         # Executar todos os testes
npm run validate     # Validar regras do sistema
```

## Padrão de Componente com Service

```tsx
import { depositService, type Deposit } from '@/services';
import { toast } from 'sonner';

function MyComponent() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await depositService.getAll();
        setDeposits(data);
      } catch (error) {
        toast.error('Erro ao carregar depósitos');
      }
    };
    load();
  }, []);
}
```

## Arquivos-Chave

| Arquivo | Função |
|---------|--------|
| `src/services/index.ts` | Barrel export + cliente Supabase |
| `src/types/supabase.ts` | Tipos das 40 tabelas (Row/Insert/Update) |
| `components/NewServiceOrder.tsx` | PDV principal |
| `components/DepositsStockModule.tsx` | Gestão de estoque |

## Deploy

- **Frontend:** Vercel (auto-deploy via `git push origin main`)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Variáveis:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## Esquema do Supabase (tabelas-chave)

Colei abaixo o esquema das tabelas relevantes conforme o banco Supabase — use isto como referência ao corrigir queries, nomes de colunas e tipos.

| tabela                   | coluna                  | tipo                     | aceita_nulo |
| ------------------------ | ----------------------- | ------------------------ | ----------- |
| accounts_receivable      | id                      | uuid                     | NO          |
| accounts_receivable      | order_id                | uuid                     | YES         |
| accounts_receivable      | deposit_id              | uuid                     | YES         |
| accounts_receivable      | client_id               | uuid                     | YES         |
| accounts_receivable      | client_name             | text                     | YES         |
| accounts_receivable      | original_amount         | numeric                  | NO          |
| accounts_receivable      | paid_amount             | numeric                  | YES         |
| accounts_receivable      | remaining_amount        | numeric                  | YES         |
| accounts_receivable      | status                  | text                     | YES         |
| accounts_receivable      | due_date                | date                     | YES         |
| accounts_receivable      | notes                   | text                     | YES         |
| accounts_receivable      | created_at              | timestamp with time zone | YES         |
| accounts_receivable      | updated_at              | timestamp with time zone | YES         |
| audit_logs               | id                      | uuid                     | NO          |
| audit_logs               | user_id                 | uuid                     | YES         |
| audit_logs               | deposit_id              | uuid                     | YES         |
| audit_logs               | entity_type             | text                     | NO          |
| audit_logs               | entity_id               | text                     | NO          |
| audit_logs               | action                  | text                     | NO          |
| audit_logs               | before_data             | jsonb                    | YES         |
| audit_logs               | after_data              | jsonb                    | YES         |
| audit_logs               | created_at              | timestamp with time zone | YES         |
| boletos                  | id                      | uuid                     | NO          |
| boletos                  | receivable_id           | uuid                     | YES         |
| boletos                  | bank_name               | text                     | YES         |
| boletos                  | barcode                 | text                     | YES         |
| boletos                  | digitable_line          | text                     | YES         |
| boletos                  | amount                  | numeric                  | NO          |
| boletos                  | due_date                | date                     | YES         |
| boletos                  | issue_date              | date                     | YES         |
| boletos                  | status                  | text                     | YES         |
| boletos                  | pdf_url                 | text                     | YES         |
| boletos                  | created_at              | timestamp with time zone | YES         |
| boletos                  | updated_at              | timestamp with time zone | YES         |
| cash_flow_entries        | id                      | uuid                     | NO          |
| cash_flow_entries        | shift_id                | uuid                     | YES         |
| cash_flow_entries        | deposit_id              | uuid                     | NO          |
| cash_flow_entries        | user_id                 | uuid                     | YES         |
| cash_flow_entries        | category                | text                     | NO          |
| cash_flow_entries        | direction               | text                     | NO          |
| cash_flow_entries        | amount                  | numeric                  | NO          |
| cash_flow_entries        | payment_method          | text                     | YES         |
| cash_flow_entries        | reference_id            | uuid                     | YES         |
| cash_flow_entries        | description             | text                     | YES         |
| cash_flow_entries        | status                  | text                     | YES         |
| cash_flow_entries        | created_at              | timestamp with time zone | YES         |
| cash_movements           | id                      | uuid                     | NO          |
| cash_movements           | cash_session_id         | uuid                     | NO          |
| cash_movements           | type                    | text                     | NO          |
| cash_movements           | amount                  | numeric                  | NO          |
| cash_movements           | order_id                | uuid                     | YES         |
| cash_movements           | description             | text                     | YES         |
| cash_movements           | created_at              | timestamp with time zone | YES         |
| cash_sessions            | id                      | uuid                     | NO          |
| cash_sessions            | deposit_id              | uuid                     | NO          |
| cash_sessions            | operator_id             | uuid                     | NO          |
| cash_sessions            | opening_balance         | numeric                  | YES         |
| cash_sessions            | current_balance         | numeric                  | YES         |
| cash_sessions            | status                  | text                     | YES         |
| cash_sessions            | opened_at               | timestamp with time zone | YES         |
| cash_sessions            | closed_at               | timestamp with time zone | YES         |
| client_one_time_benefits | id                      | uuid                     | NO          |
| client_one_time_benefits | client_id               | uuid                     | NO          |
| client_one_time_benefits | benefit_type            | text                     | YES         |
| client_one_time_benefits | discount_value          | numeric                  | YES         |
| client_one_time_benefits | discount_percent        | numeric                  | YES         |
| client_one_time_benefits | status                  | text                     | YES         |
| client_one_time_benefits | used_in_order_id        | uuid                     | YES         |
| client_one_time_benefits | expires_at              | timestamp with time zone | YES         |
| client_one_time_benefits | created_at              | timestamp with time zone | YES         |
| client_one_time_benefits | used_at                 | timestamp with time zone | YES         |
| client_price_overrides   | id                      | uuid                     | NO          |
| client_price_overrides   | client_id               | uuid                     | NO          |
| client_price_overrides   | product_id              | uuid                     | NO          |
| client_price_overrides   | deposit_id              | uuid                     | YES         |
| client_price_overrides   | modality                | text                     | YES         |
| client_price_overrides   | override_price          | numeric                  | YES         |
| client_price_overrides   | is_active               | boolean                  | YES         |
| client_price_overrides   | created_at              | timestamp with time zone | YES         |
| client_price_overrides   | updated_at              | timestamp with time zone | YES         |
| clients                  | id                      | uuid                     | NO          |
| clients                  | name                    | text                     | NO          |
| clients                  | phone                   | text                     | YES         |
| clients                  | cpf                     | text                     | YES         |
| clients                  | birth_date              | date                     | YES         |
| clients                  | address                 | text                     | YES         |
| clients                  | reference               | text                     | YES         |
| clients                  | delivery_zone_id        | uuid                     | YES         |
| clients                  | is_active               | boolean                  | YES         |
| clients                  | created_at              | timestamp with time zone | YES         |
| clients                  | updated_at              | timestamp with time zone | YES         |
| clients                  | active                  | boolean                  | YES         |
| delivery_jobs            | id                      | uuid                     | NO          |
| delivery_jobs            | order_id                | uuid                     | NO          |
| delivery_jobs            | deposit_id              | uuid                     | NO          |
| delivery_jobs            | driver_id               | uuid                     | YES         |
| delivery_jobs            | status                  | text                     | YES         |
| delivery_jobs            | priority                | integer                  | YES         |
| delivery_jobs            | notes                   | text                     | YES         |
| delivery_jobs            | created_at              | timestamp with time zone | YES         |
| delivery_jobs            | assigned_at             | timestamp with time zone | YES         |
| delivery_jobs            | started_at              | timestamp with time zone | YES         |
| delivery_jobs            | completed_at            | timestamp with time zone | YES         |
| delivery_sectors         | id                      | uuid                     | NO          |
| delivery_sectors         | zone_id                 | uuid                     | NO          |
| delivery_sectors         | name                    | text                     | NO          |
| delivery_sectors         | is_active               | boolean                  | YES         |
| delivery_sectors         | created_at              | timestamp with time zone | YES         |
| delivery_zones           | id                      | uuid                     | NO          |
| delivery_zones           | name                    | text                     | NO          |
| delivery_zones           | color                   | text                     | YES         |
| delivery_zones           | is_active               | boolean                  | YES         |
| delivery_zones           | created_at              | timestamp with time zone | YES         |
| delivery_zones           | updated_at              | timestamp with time zone | YES         |
| deposits                 | id                      | uuid                     | NO          |
| deposits                 | name                    | text                     | NO          |
| deposits                 | address                 | text                     | YES         |
| deposits                 | active                  | boolean                  | YES         |
| deposits                 | color                   | text                     | YES         |
| deposits                 | require_stock_audit     | boolean                  | YES         |
| deposits                 | free_shipping_min_value | numeric                  | YES         |
| deposits                 | created_at              | timestamp with time zone | YES         |
| deposits                 | updated_at              | timestamp with time zone | YES         |
| deposits                 | is_active               | boolean                  | YES         |
| driver_presence          | id                      | uuid                     | NO          |
| driver_presence          | driver_id               | uuid                     | NO          |
| driver_presence          | deposit_id              | uuid                     | YES         |
| driver_presence          | status                  | text                     | YES         |
| driver_presence          | last_seen_at            | timestamp with time zone | YES         |
| employees                | id                      | uuid                     | NO          |
| employees                | name                    | text                     | NO          |
| employees                | phone                   | text                     | YES         |
| employees                | cpf                     | text                     | YES         |
| employees                | username                | text                     | YES         |
| employees                | password                | text                     | YES         |
| employees                | role                    | text                     | NO          |
| employees                | permissions             | ARRAY                    | YES         |
| employees                | deposit_id              | uuid                     | YES         |
| employees                | is_active               | boolean                  | YES         |
| employees                | created_at              | timestamp with time zone | YES         |
| employees                | updated_at              | timestamp with time zone | YES         |
| employees                | active                  | boolean                  | YES         |
| expenses                 | id                      | uuid                     | NO          |
| expenses                 | description             | text                     | NO          |
| expenses                 | amount                  | numeric                  | NO          |
| expenses                 | category                | text                     | YES         |
| expenses                 | deposit_id              | uuid                     | YES         |
| expenses                 | status                  | text                     | YES         |
| expenses                 | due_date                | date                     | YES         |
| expenses                 | paid_date               | date                     | YES         |
| expenses                 | alert_days_before       | integer                  | YES         |
| expenses                 | created_at              | timestamp with time zone | YES         |
| expenses                 | updated_at              | timestamp with time zone | YES         |
| financial_movements      | id                      | uuid                     | NO          |
| financial_movements      | reference_id            | uuid                     | YES         |
| financial_movements      | reference_type          | text                     | YES         |
| financial_movements      | payment_method_id       | uuid                     | YES         |
| financial_movements      | type                    | text                     | NO          |
| financial_movements      | amount                  | numeric                  | NO          |
| financial_movements      | description             | text                     | YES         |
| financial_movements      | created_at              | timestamp with time zone | YES         |
| financial_settings       | id                      | uuid                     | NO          |
| financial_settings       | monthly_goal            | numeric                  | YES         |
| financial_settings       | updated_at              | timestamp with time zone | YES         |
| kv                       | key                     | text                     | NO          |
| kv                       | value                   | jsonb                    | YES         |
| kv                       | updated_at              | timestamp with time zone | YES         |
| machines                 | id                      | uuid                     | NO          |
| machines                 | name                    | text                     | NO          |
| machines                 | serial_number           | text                     | YES         |
| machines                 | deposit_id              | uuid                     | YES         |
| machines                 | is_active               | boolean                  | YES         |
| machines                 | created_at              | timestamp with time zone | YES         |
| machines                 | updated_at              | timestamp with time zone | YES         |
| outbox_events            | id                      | uuid                     | NO          |
| outbox_events            | entity                  | text                     | NO          |
| outbox_events            | entity_id               | text                     | NO          |
| outbox_events            | action                  | text                     | NO          |
| outbox_events            | payload                 | jsonb                    | YES         |
| outbox_events            | status                  | text                     | YES         |
| outbox_events            | attempts                | integer                  | YES         |
| outbox_events            | last_error              | text                     | YES         |
| outbox_events            | created_at              | timestamp with time zone | YES         |
| outbox_events            | updated_at              | timestamp with time zone | YES         |
| outbox_events            | sent_at                 | timestamp with time zone | YES         |
| payment_methods          | id                      | uuid                     | NO          |
| payment_methods          | name                    | text                     | NO          |
| payment_methods          | receipt_type            | text                     | YES         |
| payment_methods          | generates_receivable    | boolean                  | YES         |
| payment_methods          | is_active               | boolean                  | YES         |
| payment_methods          | created_at              | timestamp with time zone | YES         |
| payment_methods          | updated_at              | timestamp with time zone | YES         |
| price_table              | id                      | uuid                     | NO          |
| price_table              | product_id              | uuid                     | NO          |
| price_table              | modality                | text                     | NO          |
| price_table              | default_price           | numeric                  | NO          |
| price_table              | created_at              | timestamp with time zone | YES         |
| price_table              | updated_at              | timestamp with time zone | YES         |
| product_exchange_rules   | id                      | uuid                     | NO          |
| product_exchange_rules   | product_id              | uuid                     | NO          |
| product_exchange_rules   | deposit_id              | uuid                     | NO          |
| product_exchange_rules   | return_product_id       | uuid                     | NO          |
| product_exchange_rules   | is_active               | boolean                  | YES         |
| product_exchange_rules   | created_at              | timestamp with time zone | YES         |
| product_exchange_rules   | updated_at              | timestamp with time zone | YES         |
| product_pricing          | id                      | uuid                     | NO          |
| product_pricing          | product_id              | uuid                     | NO          |
| product_pricing          | deposit_id              | uuid                     | NO          |
| product_pricing          | price                   | numeric                  | NO          |
| product_pricing          | exchange_price          | numeric                  | YES         |
| product_pricing          | full_price              | numeric                  | YES         |
| product_pricing          | created_at              | timestamp with time zone | YES         |
| product_pricing          | updated_at              | timestamp with time zone | YES         |
| products                 | id                      | uuid                     | NO          |
| products                 | code                    | text                     | YES         |
| products                 | name                    | text                     | NO          |
| products                 | description             | text                     | YES         |
| products                 | type                    | text                     | YES         |
| products                 | unit                    | text                     | YES         |
| products                 | product_group           | text                     | YES         |
| products                 | image_url               | text                     | YES         |
| products                 | track_stock             | boolean                  | YES         |
| products                 | is_delivery_fee         | boolean                  | YES         |
| products                 | movement_type           | text                     | YES         |
| products                 | return_product_id       | uuid                     | YES         |
| products                 | cost_price              | numeric                  | YES         |
| products                 | sale_price              | numeric                  | YES         |
| products                 | exchange_price          | numeric                  | YES         |
| products                 | full_price              | numeric                  | YES         |
| products                 | markup                  | numeric                  | YES         |
| products                 | deposit_id              | uuid                     | YES         |
| products                 | is_active               | boolean                  | YES         |
| products                 | created_at              | timestamp with time zone | YES         |
| products                 | updated_at              | timestamp with time zone | YES         |
| products                 | active                  | boolean                  | YES         |
| products                 | tracks_empties          | boolean                  | YES         |
| receivable_payments      | id                      | uuid                     | NO          |
| receivable_payments      | receivable_id           | uuid                     | NO          |
| receivable_payments      | amount                  | numeric                  | NO          |
| receivable_payments      | payment_method          | text                     | YES         |
| receivable_payments      | user_id                 | uuid                     | YES         |
| receivable_payments      | paid_at                 | timestamp with time zone | YES         |
| receivable_titles        | id                      | uuid                     | NO          |
| receivable_titles        | order_id                | uuid                     | YES         |
| receivable_titles        | amount                  | numeric                  | NO          |
| receivable_titles        | paid_amount             | numeric                  | YES         |
| receivable_titles        | status                  | text                     | YES         |
| receivable_titles        | created_at              | timestamp with time zone | YES         |
| receivable_titles        | due_date                | date                     | YES         |
| receivables              | id                      | uuid                     | NO          |
| receivables              | deposit_id              | uuid                     | YES         |
| receivables              | client_id               | uuid                     | YES         |
| receivables              | service_order_id        | uuid                     | YES         |
| receivables              | bank_code               | text                     | YES         |
| receivables              | wallet                  | text                     | YES         |
| receivables              | our_number              | text                     | YES         |
| receivables              | digitable_line          | text                     | YES         |
| receivables              | barcode                 | text                     | YES         |
| receivables              | boleto_url              | text                     | YES         |
| receivables              | amount                  | numeric                  | YES         |
| receivables              | status                  | text                     | YES         |
| receivables              | due_date                | timestamp with time zone | YES         |
| receivables              | paid_at                 | timestamp with time zone | YES         |
| receivables              | is_active               | boolean                  | YES         |
| receivables              | created_at              | timestamp with time zone | YES         |
| receivables              | updated_at              | timestamp with time zone | YES         |
| service_order_items      | id                      | uuid                     | NO          |
| service_order_items      | order_id                | uuid                     | NO          |
| service_order_items      | product_id              | uuid                     | NO          |
| service_order_items      | quantity                | integer                  | NO          |
| service_order_items      | unit_price              | numeric                  | NO          |
| service_order_items      | modality                | text                     | YES         |
| service_order_items      | sale_movement_type      | text                     | YES         |
| service_order_items      | is_special_price        | boolean                  | YES         |
| service_order_items      | created_at              | timestamp with time zone | YES         |
| service_order_payments   | id                      | uuid                     | NO          |
| service_order_payments   | order_id                | uuid                     | NO          |
| service_order_payments   | payment_method_id       | uuid                     | YES         |
| service_order_payments   | payment_method_name     | text                     | YES         |
| service_order_payments   | amount                  | numeric                  | NO          |
| service_order_payments   | machine_id              | uuid                     | YES         |
| service_order_payments   | machine_name            | text                     | YES         |
| service_order_payments   | created_at              | timestamp with time zone | YES         |
| service_orders           | id                      | uuid                     | NO          |
| service_orders           | order_number            | text                     | NO          |
| service_orders           | deposit_id              | uuid                     | NO          |
| service_orders           | client_id               | uuid                     | YES         |
| service_orders           | client_name             | text                     | YES         |
| service_orders           | client_phone            | text                     | YES         |
| service_orders           | delivery_address        | text                     | YES         |
| service_orders           | service_type            | text                     | NO          |
| service_orders           | status                  | text                     | YES         |
| service_orders           | delivery_status         | text                     | YES         |
| service_orders           | driver_id               | uuid                     | YES         |
| service_orders           | driver_name             | text                     | YES         |
| service_orders           | subtotal                | numeric                  | YES         |
| service_orders           | delivery_fee            | numeric                  | YES         |
| service_orders           | discount                | numeric                  | YES         |
| service_orders           | total                   | numeric                  | YES         |
| service_orders           | delivery_zone_id        | uuid                     | YES         |
| service_orders           | created_at              | timestamp with time zone | YES         |
| service_orders           | completed_at            | timestamp with time zone | YES         |
| service_orders           | updated_at              | timestamp with time zone | YES         |
| shift_stock_audits       | id                      | uuid                     | NO          |
| shift_stock_audits       | shift_id                | uuid                     | YES         |
| shift_stock_audits       | deposit_id              | uuid                     | NO          |
| shift_stock_audits       | product_id              | uuid                     | NO          |
| shift_stock_audits       | opening_quantity        | integer                  | YES         |
| shift_stock_audits       | closing_quantity        | integer                  | YES         |
| shift_stock_audits       | sold_quantity           | integer                  | YES         |
| shift_stock_audits       | difference              | integer                  | YES         |
| shift_stock_audits       | created_at              | timestamp with time zone | YES         |
| stock_balance            | id                      | uuid                     | NO          |
| stock_balance            | deposit_id              | uuid                     | NO          |
| stock_balance            | product_id              | uuid                     | NO          |
| stock_balance            | quantity                | integer                  | YES         |
| stock_balance            | updated_at              | timestamp with time zone | YES         |
| stock_count_items        | id                      | uuid                     | NO          |
| stock_count_items        | count_id                | uuid                     | NO          |
| stock_count_items        | product_id              | uuid                     | NO          |
| stock_count_items        | counted_quantity        | integer                  | NO          |
| stock_count_items        | system_quantity         | integer                  | YES         |
| stock_count_items        | difference              | integer                  | YES         |
| stock_count_items        | created_at              | timestamp with time zone | YES         |
| stock_counts             | id                      | uuid                     | NO          |
| stock_counts             | deposit_id              | uuid                     | NO          |
| stock_counts             | type                    | text                     | YES         |
| stock_counts             | user_id                 | uuid                     | YES         |
| stock_counts             | status                  | text                     | YES         |
| stock_counts             | created_at              | timestamp with time zone | YES         |
| stock_counts             | closed_at               | timestamp with time zone | YES         |
| stock_movements          | id                      | uuid                     | NO          |
| stock_movements          | deposit_id              | uuid                     | NO          |
| stock_movements          | product_id              | uuid                     | NO          |
| stock_movements          | type                    | text                     | NO          |
| stock_movements          | quantity                | integer                  | NO          |
| stock_movements          | origin                  | text                     | YES         |
| stock_movements          | reason                  | text                     | YES         |
| stock_movements          | reference_id            | uuid                     | YES         |
| stock_movements          | user_id                 | uuid                     | YES         |
| stock_movements          | user_name               | text                     | YES         |
| stock_movements          | created_at              | timestamp with time zone | YES         |
| stock_transfer_items     | id                      | uuid                     | NO          |
| stock_transfer_items     | transfer_id             | uuid                     | NO          |
| stock_transfer_items     | product_id              | uuid                     | NO          |
| stock_transfer_items     | quantity                | integer                  | NO          |
| stock_transfer_items     | created_at              | timestamp with time zone | YES         |
| stock_transfers          | id                      | uuid                     | NO          |
| stock_transfers          | origin_deposit_id       | uuid                     | NO          |
| stock_transfers          | destination_deposit_id  | uuid                     | NO          |
| stock_transfers          | status                  | text                     | YES         |
| stock_transfers          | user_id                 | uuid                     | YES         |
| stock_transfers          | notes                   | text                     | YES         |
| stock_transfers          | created_at              | timestamp with time zone | YES         |
| stock_transfers          | completed_at            | timestamp with time zone | YES         |
| work_shifts              | id                      | uuid                     | NO          |
| work_shifts              | deposit_id              | uuid                     | NO          |
| work_shifts              | user_id                 | uuid                     | NO          |
| work_shifts              | user_name               | text                     | YES         |
| work_shifts              | status                  | text                     | YES         |
| work_shifts              | opening_balance         | numeric                  | YES         |
| work_shifts              | closing_balance         | numeric                  | YES         |
| work_shifts              | declared_cash           | numeric                  | YES         |
| work_shifts              | declared_card           | numeric                  | YES         |
| work_shifts              | declared_pix            | numeric                  | YES         |
| work_shifts              | system_cash             | numeric                  | YES         |
| work_shifts              | system_card             | numeric                  | YES         |
| work_shifts              | system_pix             | numeric                  | YES         |
| work_shifts              | discrepancy             | numeric                  | YES         |
| work_shifts              | opened_at               | timestamp with time zone | YES         |
| work_shifts              | closed_at               | timestamp with time zone | YES         |
| zone_pricing             | id                      | uuid                     | NO          |
| zone_pricing             | zone_id                 | uuid                     | NO          |
| zone_pricing             | deposit_id              | uuid                     | NO          |
| zone_pricing             | price                   | numeric                  | NO          |
| zone_pricing             | created_at              | timestamp with time zone | YES         |
| zone_pricing             | updated_at              | timestamp with time zone | YES         |
