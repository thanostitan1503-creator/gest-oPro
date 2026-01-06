import Dexie, { Table } from 'dexie';
import {
  Produto,
  Colaborador,
  Deposit,
  PaymentMethod,
  Maquininha,
  OrdemServico,
  ItemOrdemServico,
  MovimentoEstoque,
  MovimentoFinanceiro,
  TituloReceber,
  DeliveryJob,
  DriverPresence,
  Expense,
  WorkShift,
  CashFlowEntry,
  ShiftStockAudit,
  DeliveryZone,
  DeliverySector,
  ZonePricing,
  ProductPricing,
  ProductExchangeRule,
} from './types';

function toIso(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function toCode(nome: string, id: string) {
  const base = String(nome ?? 'PROD')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const suffix = String(id).replace(/-/g, '').slice(-6).toLowerCase();
  return suffix ? `${base}_${suffix}` : base || 'produto';
}

function calcMarcacao(preco_custo: number, preco_venda: number): number | null {
  if (!preco_custo || preco_custo <= 0) return null;
  return ((preco_venda - preco_custo) / preco_custo) * 100;
}

function canonicalizeLegacyProductRow(row: any): Produto {
  const id = String(row?.id ?? generateId());
  const nome = String(row?.nome ?? row?.name ?? '').trim();
  const tipo = (row?.tipo ?? row?.type ?? 'OUTROS') as Produto['tipo'];

  const preco_padrao = Number(row?.preco_padrao ?? row?.precoPadrao ?? row?.base_price ?? row?.default_price ?? 0) || 0;
  const preco_custo = Number(row?.preco_custo ?? row?.precoCusto ?? row?.cost_price ?? 0) || 0;
  const preco_venda = Number(row?.preco_venda ?? row?.precoVenda ?? row?.sale_price ?? preco_padrao) || 0;

  const codigo = String(row?.codigo ?? row?.code ?? row?.sku ?? '').trim() || toCode(nome || 'PROD', id);
  const product_group = (row?.product_group ?? row?.productGroup ?? codigo) ?? null;

  const created_at = toIso(row?.created_at ?? row?.criado_em) ?? new Date().toISOString();
  const updated_at = toIso(row?.updated_at ?? row?.atualizado_em) ?? created_at;

  return {
    id,
    codigo,
    nome,
    tipo,
    descricao: row?.descricao ?? row?.description ?? null,
    unidade: row?.unidade ?? row?.unit ?? 'un',
    product_group: product_group ?? null,
    imagem_url: row?.imagem_url ?? row?.image_url ?? row?.imagemUrl ?? null,
    deposit_id: row?.deposit_id ?? row?.depositId ?? null,
    preco_padrao,
    preco_custo,
    preco_venda,
    marcacao: row?.marcacao ?? row?.markup ?? calcMarcacao(preco_custo, preco_venda),
    tracks_empties: Boolean((row?.tracks_empties ?? row?.tracksEmpties ?? (tipo === 'GAS_CHEIO')) || !!row?.produtoCascoId),
    ativo: Boolean(row?.ativo ?? row?.is_active ?? true),
    created_at,
    updated_at,
  };
}

// Tipos complementares (ainda não mapeados em domain/types)
export interface PriceTableEntry {
  id: string;
  product_id: string;
  modalidade: string;
  preco_padrao: number;
}

export interface ClienteEntity {
  id: string;
  nome: string;
  endereco: string;
  referencia?: string;
  cpf?: string;
  telefone?: string;
  aniversario?: string;
  ativo?: boolean;
  delivery_zone_id?: string | null;
  criado_em: number;
  atualizado_em: number;
}

export interface ClientPriceOverride {
  id: string;
  client_id: string;
  product_id: string;
  modalidade: string;
  preco_override: number | null;
  atualizado_em: number;
}

export interface ClientOneTimeDiscount {
  id: string;
  client_id: string;
  tipo: 'VALOR' | 'PERCENTUAL';
  valor: number;
  status: 'PENDENTE' | 'USADO' | 'CANCELADO';
  criado_em: number;
  usado_em?: number | null;
}

export interface AccountsReceivable {
  id: string;
  os_id: string | null;
  payment_method_id: string | null;
  deposit_id: string | null;
  devedor_nome: string | null;
  valor_total: number;
  valor_pago: number;
  status: 'ABERTO' | 'PARCIAL' | 'PAGO' | 'VENCIDO';
  criado_em: number;
  vencimento_em: number;
  description?: string | null;
  client_id?: string | null;
  requires_boleto?: boolean;
  is_personal?: boolean;
  alert_days_before?: number;
  installment_no?: number;
  installments_total?: number;
}

export interface FinancialSetting {
  id: string;
  monthly_goal: number;
  updated_at?: string | null;
}

export interface ReceivablePayment {
  id: string;
  receivable_id: string;
  valor: number;
  data_hora: number;
  usuario_id: string;
  payment_method_id?: string | null;
  obs?: string | null;
}

export interface StockBalanceRow {
  id: string;
  deposit_id: string;
  product_id: string;
  quantidade_atual: number;
}

export interface StockTransfer {
  id: string;
  origem_deposit_id: string;
  destino_deposit_id: string;
  usuario_id: string;
  criado_em: number;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantidade: number;
}

export interface CashSession {
  id: string;
  deposit_id: string;
  operador_id: string;
  aberto_em: number;
  fechado_em?: number | null;
  suprimento_troco_valor?: number;
  resumo_final_json?: any;
}

export interface CashMovement {
  id: string;
  cash_session_id: string;
  tipo: 'SUPRIMENTO_TROCO' | 'RECEBIMENTO_OS' | 'SANGRIA_CAIXA' | 'ESTORNO' | 'AJUSTE';
  valor: number;
  payment_method_id?: string;
  os_id?: string;
  motivo?: string;
  criado_em: number;
  usuario_id: string;
}

export interface StockCount {
  id: string;
  deposit_id: string;
  usuario_id: string;
  tipo: 'ABERTURA_DIA' | 'FECHAMENTO_DIA';
  criado_em: number;
  observacao?: string;
}

export interface StockCountItem {
  id: string;
  count_id: string;
  product_id: string;
  quantidade_contada: number;
}

export interface AuditLogRow {
  id: string;
  usuario_id: string;
  depositoId?: string; // ✅ Padrão único (camelCase)
  entidade: 'OS' | 'ESTOQUE' | 'PAGAMENTO' | 'CLIENTE' | 'COLABORADOR' | 'DEPOSITO' | 'MODALIDADE' | 'DELIVERY' | 'GENERICA';
  entidade_id: string;
  acao: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'LOGIN' | 'AJUSTE';
  antes_json?: any;
  depois_json?: any;
  criado_em: number;
}

// --- OUTBOX (Offline-first) ---

export type OutboxEntity =
  | 'products'
  | 'zone_pricing'
  | 'product_exchange_rules'
  | 'deposits'
  | 'employees'
  | 'clients'
  | 'client_price_overrides'
  | 'client_one_time_discount'
  | 'service_orders'
  | 'stock_movements'
  | 'payment_methods'
  | 'receivables'
  | 'accounts_receivable'
  | 'receivable_payments'
  | 'financial_settings'
  | 'delivery_jobs'
  | 'delivery_zones'
  | 'delivery_sectors'
  | 'zone_pricing'
  | 'product_pricing'
  | 'expenses'
  | 'work_shifts'
  | 'cash_flow_entries'
  | 'shift_stock_audits';
export type OutboxAction = 'UPSERT' | 'DELETE';
export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface OutboxEventRow {
  id: string;
  entity: OutboxEntity;
  action: OutboxAction;
  entity_id: string;
  payload_json?: any;
  created_at: number;
  updated_at: number;
  status: OutboxStatus;
  attempts: number;
  last_error?: string;
  synced_at?: number;
}

// Banco Dexie com todas as tabelas mínimas
export class GestaoProDB extends Dexie {
  deposits!: Table<Deposit, string>;
  products!: Table<Produto, string>;
  price_table!: Table<PriceTableEntry, string>;
  employees!: Table<Colaborador, string>;
  clients!: Table<ClienteEntity, string>;
  client_price_overrides!: Table<ClientPriceOverride, string>;
  client_one_time_discount!: Table<ClientOneTimeDiscount, string>;
  service_orders!: Table<OrdemServico, string>;
  service_order_items!: Table<ItemOrdemServico, string>;
  payment_methods!: Table<PaymentMethod, string>;
  machines!: Table<Maquininha, string>;
  receivables!: Table<AccountsReceivable, string>;
  accounts_receivable!: Table<AccountsReceivable, string>;
  receivable_payments!: Table<ReceivablePayment, string>;
  financial_settings!: Table<FinancialSetting, string>;
  stock_balance!: Table<StockBalanceRow, string>;
  stock_movements!: Table<MovimentoEstoque, string>;
  stock_transfers!: Table<StockTransfer, string>;
  stock_transfer_items!: Table<StockTransferItem, string>;
  cash_sessions!: Table<CashSession, string>;
  cash_movements!: Table<CashMovement, string>;
  stock_counts!: Table<StockCount, string>;
  stock_count_items!: Table<StockCountItem, string>;
  audit_logs!: Table<AuditLogRow, string>;
  financial_movements!: Table<MovimentoFinanceiro, string>;
  receivable_titles!: Table<TituloReceber, string>;
  delivery_jobs!: Table<DeliveryJob, string>;
  driver_presence!: Table<DriverPresence, string>;
  delivery_zones!: Table<DeliveryZone, string>;
  delivery_sectors!: Table<DeliverySector, string>;
  zone_pricing!: Table<ZonePricing, string>;
  product_pricing!: Table<ProductPricing, string>;
  product_exchange_rules!: Table<ProductExchangeRule, string>;
  expenses!: Table<Expense, string>;
  work_shifts!: Table<WorkShift, string>;
  cash_flow_entries!: Table<CashFlowEntry, string>;
  shift_stock_audits!: Table<ShiftStockAudit, string>;
  outbox_events!: Table<OutboxEventRow, string>;

  constructor() {
    super('GestaoProDexie');
    this.version(1).stores({
      deposits: 'id, nome, ativo',
      products: 'id, nome, ativo, tipo',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, nome, tipoFluxo, ativo',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt'
    });

    // v2: adiciona Outbox Queue para sincronização com Supabase (offline-first)
    this.version(2).stores({
      deposits: 'id, nome, ativo',
      products: 'id, nome, ativo, tipo',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, nome, tipoFluxo, ativo',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    });

    // v3: padroniza products (snake_case oficial) e sanitiza payloads antigos na outbox
    this.version(3)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, nome, tipoFluxo, ativo',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        const productsTable = tx.table('products');
        const outboxTable = tx.table('outbox_events');

        // 1) Migra rows de products para o contrato oficial
        await productsTable.toCollection().modify((p: any) => {
          const alreadyCanonical = p && typeof p === 'object' && 'preco_padrao' in p && 'preco_custo' in p;
          const canonical = alreadyCanonical ? (p as Produto) : canonicalizeLegacyProductRow(p);

          // Reaplica garantindo que só existam chaves oficiais (e que valores mínimos existam)
          const preco_padrao = Number(canonical.preco_padrao ?? 0) || 0;
          const preco_custo = Number(canonical.preco_custo ?? 0) || 0;
          const preco_venda = Number(canonical.preco_venda ?? preco_padrao) || 0;
          const codigo = String(canonical.codigo ?? '').trim() || toCode(String(canonical.nome ?? 'PROD'), String(canonical.id));
          const created_at = canonical.created_at ?? new Date().toISOString();
          const updated_at = canonical.updated_at ?? created_at;

          const clean: Produto = {
            id: String(canonical.id),
            codigo,
            nome: String(canonical.nome ?? ''),
            tipo: (canonical.tipo ?? 'OUTROS') as any,
            descricao: canonical.descricao ?? null,
            unidade: canonical.unidade ?? 'un',
            product_group: canonical.product_group ?? codigo,
            imagem_url: canonical.imagem_url ?? null,
            deposit_id: canonical.deposit_id ?? null,
            preco_padrao,
            preco_custo,
            preco_venda,
            marcacao: canonical.marcacao ?? calcMarcacao(preco_custo, preco_venda),
            tracks_empties: Boolean(canonical.tracks_empties ?? ((canonical.tipo as any) === 'GAS_CHEIO')),
            ativo: Boolean(canonical.ativo ?? true),
            created_at,
            updated_at,
          };

          // Escreve as chaves oficiais e remove legadas
          for (const k of Object.keys(p)) delete (p as any)[k];
          Object.assign(p, clean);
        });

        // 2) Sanitiza payloads antigos da outbox de products para não sincronizar campos legados
        const allProducts = (await productsTable.toArray()) as Produto[];
        const byId = new Map<string, Produto>(allProducts.map((pr) => [pr.id, pr]));

        // 2a) Garante cascos para grupos que rastreiam vazios (evita quebrar telas de recarga/estoque)
        const existingShellGroups = new Set(
          allProducts
            .filter((p) => p.tipo === 'VASILHAME_VAZIO' && !!p.product_group)
            .map((p) => String(p.product_group))
        );

        const now = Date.now();
        for (const p of allProducts) {
          if (p.tipo !== 'GAS_CHEIO') continue;
          if (!p.tracks_empties) continue;
          if (!p.product_group) continue;

          const group = String(p.product_group);
          if (existingShellGroups.has(group)) continue;

          const shell: Produto = {
            id: generateId(),
            codigo: `${p.codigo}_casco`,
            nome: `Casco - ${p.nome}`,
            tipo: 'VASILHAME_VAZIO',
            descricao: null,
            unidade: p.unidade ?? 'un',
            product_group: group,
            imagem_url: null,
            deposit_id: p.deposit_id ?? null,
            preco_padrao: 0,
            preco_custo: 0,
            preco_venda: 0,
            marcacao: null,
            tracks_empties: false,
            ativo: true,
            created_at: p.created_at,
            updated_at: p.updated_at,
          };

          await productsTable.put(shell);
          await outboxTable.put({
            id: generateId(),
            entity: 'products',
            action: 'UPSERT',
            entity_id: shell.id,
            payload_json: shell,
            created_at: now,
            updated_at: now,
            status: 'PENDING',
            attempts: 0,
          });

          existingShellGroups.add(group);
          byId.set(shell.id, shell);
        }

        await tx.table('outbox_events').toCollection().modify((e: any) => {
          if (e?.entity !== 'products' || e?.action !== 'UPSERT') return;
          const prod = byId.get(String(e.entity_id));
          if (prod) {
            e.payload_json = prod;
            return;
          }

          const legacy = e.payload_json;
          if (legacy && typeof legacy === 'object') {
            const canon = canonicalizeLegacyProductRow(legacy);
            e.payload_json = canon;
          }
        });
      });

    // v4: adiciona store de payment_methods com contrato canônico (Nome, receipt_type, is_active)
    this.version(4)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, Nome, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        const pmTable = tx.table('payment_methods');

        await pmTable.toCollection().modify((p: any) => {
          const clean: PaymentMethod = {
            id: String(p?.id ?? generateId()),
            name: String(p?.name ?? p?.Nome ?? p?.nome ?? ''),
            // normalize to allowed receipt_type values, fallback to 'other'
            receipt_type: ((): PaymentMethod['receipt_type'] => {
              const val = String(p?.receipt_type ?? p?.tipoFluxo ?? p?.tipo_fluxo ?? '').toLowerCase();
              const allowed = ['cash', 'card', 'pix', 'fiado', 'boleto', 'other'];
              return (allowed.includes(val) ? (val as any) : 'other');
            })(),
            default_due_days: Number(p?.default_due_days ?? p?.prazoPadraoDias ?? p?.prazo_padrao_dias ?? 0) || 0,
            enters_receivables: Boolean(p?.enters_receivables ?? p?.geraContasReceber ?? p?.gera_contas_receber ?? false),
            machine_label: p?.machine_label ?? p?.maquininhaId ?? p?.maquininha_id ?? p?.machine_id ?? '',
            is_active: Boolean(p?.is_active ?? p?.ativo ?? p?.active ?? true),
            created_at: p?.created_at ?? toIso(p?.criado_em) ?? null,
            updated_at: p?.updated_at ?? toIso(p?.atualizado_em) ?? (p?.created_at ?? toIso(p?.criado_em) ?? null),
          };

          for (const k of Object.keys(p || {})) delete (p as any)[k];
          Object.assign(p, clean);
        });
      });

    // v5: renomeia campo Nome -> name no store de payment_methods e ajusta índices
    this.version(5)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, name, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        const pmTable = tx.table('payment_methods');
        await pmTable.toCollection().modify((p: any) => {
          const clean: PaymentMethod = {
            id: String(p?.id ?? generateId()),
            name: String(p?.name ?? p?.Nome ?? p?.nome ?? ''),
            receipt_type: ((): PaymentMethod['receipt_type'] => {
              const val = String(p?.receipt_type ?? '').toLowerCase();
              const allowed = ['cash', 'card', 'pix', 'fiado', 'boleto', 'other'];
              return (allowed.includes(val) ? (val as any) : 'other');
            })(),
            default_due_days: Number(p?.default_due_days ?? 0) || 0,
            enters_receivables: Boolean(p?.enters_receivables ?? false),
            machine_label: p?.machine_label ?? '',
            is_active: Boolean(p?.is_active ?? true),
            created_at: p?.created_at ?? toIso(p?.criado_em) ?? null,
            updated_at: p?.updated_at ?? toIso(p?.atualizado_em) ?? (p?.created_at ?? toIso(p?.criado_em) ?? null),
          };

          for (const k of Object.keys(p || {})) delete (p as any)[k];
          Object.assign(p, clean);
        });
      });

    // v6: adiciona índice dataHoraCriacao em service_orders
    this.version(6)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, name, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      });

    // v7: adiciona tabela de despesas (expenses)
    this.version(7).stores({
      deposits: 'id, nome, ativo',
      products: 'id, codigo, nome, ativo, tipo, product_group',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, name, receipt_type, is_active',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      expenses: 'id, status, due_date, category',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    });

    // v8: sanitize any legacy usage of the string 'GLOBAL' in deposit_id fields
    // standardize to null for global access across tables (clients/prices/employees/receivables)
    this.version(8).stores({
      deposits: 'id, nome, ativo',
      products: 'id, codigo, nome, ativo, tipo, product_group',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, name, receipt_type, is_active',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      expenses: 'id, status, due_date, category',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    }).upgrade(async (tx) => {
      // Replace any literal 'GLOBAL' values in deposit_id fields with null
      try {
        await tx.table('client_price_overrides').toCollection().modify((r: any) => {
          if (r?.deposit_id === 'GLOBAL') r.deposit_id = null;
        });

        // sanitize any clients that carry a legacy deposit_id field set to 'GLOBAL'
        await tx.table('clients').toCollection().modify((c: any) => {
          if (c?.deposit_id === 'GLOBAL') c.deposit_id = null;
          // if some clients mistakenly have a depositId / depositoId variant, normalize
          if (c?.depositId === 'GLOBAL') c.depositId = null;
          if (c?.depositoId === 'GLOBAL') c.depositoId = null;
        });

        await tx.table('employees').toCollection().modify((e: any) => {
          if (e?.deposit_id === 'GLOBAL') e.deposit_id = null;
        });

        await tx.table('accounts_receivable').toCollection().modify((a: any) => {
          if (a?.deposit_id === 'GLOBAL') a.deposit_id = null;
        });

        // Also sanitize any outbox payloads referencing deposit_id:'GLOBAL'
        await tx.table('outbox_events').toCollection().modify((ev: any) => {
          const pj = ev?.payload_json;
          if (pj && typeof pj === 'object') {
            const paths = ['deposit_id', 'depositId', 'depositoId'];
            let changed = false;
            for (const p of paths) {
              if (pj[p] === 'GLOBAL') {
                pj[p] = null;
                changed = true;
              }
            }
            if (changed) ev.payload_json = pj;
          }
        });
      } catch (err) {
        // non-fatal: if a table doesn't exist in this DB state, ignore
        console.warn('v8 upgrade sanitize GLOBAL -> null failed', err);
      }
    });

    // v9: schema bump to ensure outbox_events exists on all installs
    this.version(9).stores({
      deposits: 'id, nome, ativo',
      products: 'id, codigo, nome, ativo, tipo, product_group',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, name, receipt_type, is_active',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      expenses: 'id, status, due_date, category',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    });

    // v10: shift management + cash flow entries
    this.version(10).stores({
      deposits: 'id, nome, ativo',
      products: 'id, codigo, nome, ativo, tipo, product_group',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, name, receipt_type, is_active',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      expenses: 'id, status, due_date, category',
      work_shifts: 'id, deposit_id, user_id, status, opened_at',
      cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
      shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    });

    // v11: delivery zones + sectors
    this.version(11).stores({
      deposits: 'id, nome, ativo',
      products: 'id, codigo, nome, ativo, tipo, product_group',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, name, receipt_type, is_active',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      delivery_zones: 'id, deposit_id, name',
      delivery_sectors: 'id, zone_id, name',
      expenses: 'id, status, due_date, category',
      work_shifts: 'id, deposit_id, user_id, status, opened_at',
      cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
      shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    });

    // v12: zone pricing per deposit
    this.version(12).stores({
      deposits: 'id, nome, ativo',
      products: 'id, codigo, nome, ativo, tipo, product_group',
      price_table: 'id, product_id, modalidade',
      employees: 'id, username, deposit_id, cargo, ativo',
      clients: 'id, nome, ativo',
      client_price_overrides: 'id, client_id, product_id, modalidade',
      client_one_time_discount: 'id, client_id, status',
      service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
      service_order_items: 'id, osId, produtoId',
      payment_methods: 'id, name, receipt_type, is_active',
      machines: 'id, nome, ativo',
      accounts_receivable: 'id, os_id, status, deposit_id',
      receivable_payments: 'id, receivable_id, data_hora',
      financial_settings: 'id, monthly_goal',
      stock_balance: 'id, [deposit_id+product_id]',
      stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
      stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
      stock_transfer_items: 'id, transfer_id, product_id',
      cash_sessions: 'id, deposit_id, operador_id',
      cash_movements: 'id, cash_session_id, tipo, os_id',
      stock_counts: 'id, deposit_id, usuario_id, tipo',
      stock_count_items: 'id, count_id, product_id',
      audit_logs: 'id, entidade, entidade_id, acao, criado_em',
      financial_movements: 'id, referenciaId, formaPagamentoId',
      receivable_titles: 'id, osId, status',
      delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
      driver_presence: 'driverId, status, lastSeenAt',
      delivery_zones: 'id, deposit_id, name',
      delivery_sectors: 'id, zone_id, name',
      zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
      expenses: 'id, status, due_date, category',
      work_shifts: 'id, deposit_id, user_id, status, opened_at',
      cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
      shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
      outbox_events: 'id, status, entity, action, entity_id, created_at'
    });

    // v13: normaliza Taxa de entrega como servico (sem estoque)
    this.version(13)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, name, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        delivery_zones: 'id, deposit_id, name',
        delivery_sectors: 'id, zone_id, name',
        zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
        expenses: 'id, status, due_date, category',
        work_shifts: 'id, deposit_id, user_id, status, opened_at',
        cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
        shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        try {
          const productsTable = tx.table('products');
          const outboxTable = tx.table('outbox_events');
          const all = await productsTable.toArray();
          const nowIso = new Date().toISOString();
          const now = Date.now();

          for (const p of all) {
            const group = String((p as any).product_group ?? (p as any).codigo ?? '').toLowerCase();
            const name = String((p as any).nome ?? '').toLowerCase();
            if (group !== 'delivery_fee' && name !== 'taxa de entrega') continue;

            const needsUpdate =
              (p as any).track_stock !== false ||
              (p as any).type !== 'SERVICE' ||
              (p as any).deposit_id !== null ||
              (p as any).preco_padrao !== 0 ||
              (p as any).preco_custo !== 0 ||
              (p as any).preco_venda !== 0 ||
              (p as any).product_group !== 'delivery_fee' ||
              (p as any).codigo !== 'delivery_fee';

            if (!needsUpdate) continue;

            const updated: Produto = {
              ...(p as Produto),
              nome: 'Taxa de entrega',
              tipo: 'OUTROS',
              unidade: 'serv',
              product_group: 'delivery_fee',
              codigo: 'delivery_fee',
              deposit_id: null,
              preco_padrao: 0,
              preco_custo: 0,
              preco_venda: 0,
              marcacao: null,
              tracks_empties: false,
              track_stock: false,
              type: 'SERVICE',
              current_stock: null,
              min_stock: null,
              updated_at: nowIso,
            };

            await productsTable.put(updated);
            await outboxTable.put({
              id: generateId(),
              entity: 'products',
              action: 'UPSERT',
              entity_id: updated.id,
              payload_json: updated,
              created_at: now,
              updated_at: now,
              status: 'PENDING',
              attempts: 0,
            });
          }
        } catch (err) {
          console.warn('v13 upgrade delivery fee normalize failed', err);
        }
      });



    // Alias canônico: preferimos "receivables" como nome curto em inglês, mas
    // mantemos a store física existente "accounts_receivable" para compatibilidade.
    // v14: marca Taxa de entrega com flag dedicada de servico
    this.version(14)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, name, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        delivery_zones: 'id, deposit_id, name',
        delivery_sectors: 'id, zone_id, name',
        zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
        expenses: 'id, status, due_date, category',
        work_shifts: 'id, deposit_id, user_id, status, opened_at',
        cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
        shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        try {
          const productsTable = tx.table('products');
          const outboxTable = tx.table('outbox_events');
          const all = await productsTable.toArray();
          const nowIso = new Date().toISOString();
          const now = Date.now();

          for (const p of all) {
            const group = String((p as any).product_group ?? (p as any).codigo ?? '').toLowerCase();
            const name = String((p as any).nome ?? '').toLowerCase();
            const flagged =
              (p as any).is_delivery_fee === true ||
              (p as any).isDeliveryFee === true;
            const isDeliveryFee =
              flagged ||
              group === 'delivery_fee' ||
              name === 'taxa de entrega';
            if (!isDeliveryFee) continue;

            const needsUpdate =
              (p as any).track_stock !== false ||
              (p as any).type !== 'SERVICE' ||
              (p as any).deposit_id !== null ||
              (p as any).preco_padrao !== 0 ||
              (p as any).preco_custo !== 0 ||
              (p as any).preco_venda !== 0 ||
              (p as any).product_group !== 'delivery_fee' ||
              (p as any).codigo !== 'delivery_fee' ||
              (p as any).is_delivery_fee !== true;

            if (!needsUpdate) continue;

            const updated: Produto = {
              ...(p as Produto),
              nome: 'Taxa de entrega',
              tipo: 'OUTROS',
              unidade: 'serv',
              product_group: 'delivery_fee',
              codigo: 'delivery_fee',
              deposit_id: null,
              preco_padrao: 0,
              preco_custo: 0,
              preco_venda: 0,
              marcacao: null,
              tracks_empties: false,
              track_stock: false,
              type: 'SERVICE',
              current_stock: null,
              min_stock: null,
              is_delivery_fee: true,
              updated_at: nowIso,
            };

            await productsTable.put(updated);
            await outboxTable.put({
              id: generateId(),
              entity: 'products',
              action: 'UPSERT',
              entity_id: updated.id,
              payload_json: updated,
              created_at: now,
              updated_at: now,
              status: 'PENDING',
              attempts: 0,
            });
          }
        } catch (err) {
          console.warn('v14 upgrade delivery fee flag failed', err);
        }
      });

    // v15: define regras de movimentacao de estoque por produto
    this.version(15)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao, entregadorId',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, name, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId, usuarioId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        delivery_zones: 'id, deposit_id, name',
        delivery_sectors: 'id, zone_id, name',
        zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
        expenses: 'id, status, due_date, category',
        work_shifts: 'id, deposit_id, user_id, status, opened_at',
        cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
        shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        try {
          const productsTable = tx.table('products');
          const outboxTable = tx.table('outbox_events');
          const all = await productsTable.toArray();
          const nowIso = new Date().toISOString();
          const now = Date.now();

          const emptyByGroup = new Map<string, Produto>();
          for (const p of all) {
            if ((p as any).tipo !== 'VASILHAME_VAZIO') continue;
            const group = String((p as any).product_group ?? '');
            if (group) {
              emptyByGroup.set(group, p as Produto);
            }
          }

          for (const p of all) {
            const track = (p as any).track_stock ?? (p as any).trackStock;
            const isService = track === false || (p as any).type === 'SERVICE';
            const movementRaw = String(
              (p as any).movement_type ?? (p as any).movementType ?? ''
            ).toUpperCase();
            const movementValid =
              movementRaw === 'EXCHANGE' || movementRaw === 'FULL' || movementRaw === 'SIMPLE';
            const tracksEmpties = Boolean((p as any).tracks_empties ?? (p as any).tipo === 'GAS_CHEIO');
            const movementType = movementValid
              ? movementRaw
              : isService
                ? 'SIMPLE'
                : tracksEmpties
                  ? 'EXCHANGE'
                  : 'SIMPLE';
            let returnId =
              (p as any).return_product_id ?? (p as any).returnProductId ?? null;
            if (movementType !== 'EXCHANGE') {
              returnId = null;
            } else if (!returnId) {
              const group = String((p as any).product_group ?? '');
              const shell = group ? emptyByGroup.get(group) : null;
              returnId = shell?.id ?? null;
            }

            const needsUpdate =
              (p as any).movement_type !== movementType ||
              (p as any).return_product_id !== returnId;
            if (!needsUpdate) continue;

            const updated: Produto = {
              ...(p as Produto),
              movement_type: movementType,
              return_product_id: returnId,
              updated_at: nowIso,
            };

            await productsTable.put(updated);
            await outboxTable.put({
              id: generateId(),
              entity: 'products',
              action: 'UPSERT',
              entity_id: updated.id,
              payload_json: updated,
              created_at: now,
              updated_at: now,
              status: 'PENDING',
              attempts: 0,
            });
          }
                } catch (err) {
                  console.warn('v15 upgrade movement rules failed', err);
                }
              });
        
            // v16: Normalize Deposit interface (PT -> EN)
            this.version(16)
              .stores({
                deposits: 'id, name, active',
                products: 'id, codigo, nome, ativo, tipo, product_group',
                price_table: 'id, product_id, modalidade',
                employees: 'id, username, deposit_id, cargo, ativo',
                clients: 'id, nome, ativo',
                client_price_overrides: 'id, client_id, product_id, modalidade',
                client_one_time_discount: 'id, client_id, status',
                service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao, entregadorId',
                service_order_items: 'id, osId, produtoId',
                payment_methods: 'id, name, receipt_type, is_active',
                machines: 'id, nome, ativo',
                accounts_receivable: 'id, os_id, status, deposit_id',
                receivable_payments: 'id, receivable_id, data_hora',
                financial_settings: 'id, monthly_goal',
                stock_balance: 'id, [deposit_id+product_id]',
                stock_movements: 'id, depositoId, produtoId, origem, referenciaId, usuarioId',
                stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
                stock_transfer_items: 'id, transfer_id, product_id',
                cash_sessions: 'id, deposit_id, operador_id',
                cash_movements: 'id, cash_session_id, tipo, os_id',
                stock_counts: 'id, deposit_id, usuario_id, tipo',
                stock_count_items: 'id, count_id, product_id',
                audit_logs: 'id, entidade, entidade_id, acao, criado_em',
                financial_movements: 'id, referenciaId, formaPagamentoId',
                receivable_titles: 'id, osId, status',
                delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
                driver_presence: 'driverId, status, lastSeenAt',
                    delivery_zones: 'id, deposit_id, name',
                    delivery_sectors: 'id, zone_id, name',
                zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
                expenses: 'id, status, due_date, category',
                work_shifts: 'id, deposit_id, user_id, status, opened_at',
                cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
                shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
                outbox_events: 'id, status, entity, action, entity_id, created_at'
              })
              .upgrade(async (tx) => {
                const table = tx.table('deposits');
                await table.toCollection().modify((d: any) => {
                     d.name = d.name || d.nome || '';
                     d.address = d.address || d.endereco || null;
                     d.active = d.active ?? d.ativo ?? true;
                     d.color = d.color || d.corIdentificacao || null;
                     
                     delete d.nome;
                     delete d.endereco;
                     delete d.ativo;
                     delete d.corIdentificacao;
                });
              });
        
            // v17: zone_pricing
            this.version(17).stores({
                deposits: 'id, name, active',
                products: 'id, codigo, nome, ativo, tipo, product_group, depositoId',
                price_table: 'id, product_id, modalidade',
                product_pricing: 'id, [productId+depositoId], productId, depositoId',
                employees: 'id, username, deposit_id, cargo, ativo',
                clients: 'id, nome, ativo',
                client_price_overrides: 'id, client_id, product_id, modalidade',
                client_one_time_discount: 'id, client_id, status',
                service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao, entregadorId',
                service_order_items: 'id, osId, produtoId',
                payment_methods: 'id, name, receipt_type, is_active',
                machines: 'id, nome, ativo',
                accounts_receivable: 'id, os_id, status, deposit_id',
                receivable_payments: 'id, receivable_id, data_hora',
                financial_settings: 'id, monthly_goal',
                stock_balance: 'id, [deposit_id+product_id]',
                stock_movements: 'id, depositoId, produtoId, origem, referenciaId, usuarioId',
                stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
                stock_transfer_items: 'id, transfer_id, product_id',
                cash_sessions: 'id, deposit_id, operador_id',
                cash_movements: 'id, cash_session_id, tipo, os_id',
                stock_counts: 'id, deposit_id, usuario_id, tipo',
                stock_count_items: 'id, count_id, product_id',
                audit_logs: 'id, entidade, entidade_id, acao, criado_em',
                financial_movements: 'id, referenciaId, formaPagamentoId',
                receivable_titles: 'id, osId, status',
                delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
                driver_presence: 'driverId, status, lastSeenAt',
                delivery_zones: 'id, deposit_id, name',
                delivery_sectors: 'id, zone_id, name',
                zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
                expenses: 'id, status, due_date, category',
                work_shifts: 'id, deposit_id, user_id, status, opened_at',
                cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
                shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
                outbox_events: 'id, status, entity, action, entity_id, created_at'
            }).upgrade(async (tx) => {
                console.log('v17: Migrating prices...');
                const prods = await tx.table('products').toArray();
                const prices: any[] = [];
                for (const p of prods) {
                  const did = (p as any).depositoId ?? (p as any).deposit_id;
                  if (!did) continue;
                  const px = (p as any).preco_venda ?? (p as any).preco_padrao ?? 0;
                  if (px <= 0) continue;
                  prices.push({id: `${p.id}:${did}`, productId: p.id, depositoId: did, price: px, created_at: new Date().toISOString(), updated_at: new Date().toISOString()});
                }
                if (prices.length) await tx.table('product_pricing').bulkAdd(prices);
                console.log(`v17: ${prices.length} prices migrated`);
            });

                // v18: product_exchange_rules (ligações de troca por depósito)
                this.version(18).stores({
                  deposits: 'id, name, active',
                  products: 'id, codigo, nome, ativo, tipo, product_group, depositoId',
                  price_table: 'id, product_id, modalidade',
                  product_pricing: 'id, [productId+depositoId], productId, depositoId',
                  product_exchange_rules: 'id, [productId+depositoId], productId, depositoId',
                  employees: 'id, username, deposit_id, cargo, ativo',
                  clients: 'id, nome, ativo',
                  client_price_overrides: 'id, client_id, product_id, modalidade',
                  client_one_time_discount: 'id, client_id, status',
                  service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao, entregadorId',
                  service_order_items: 'id, osId, produtoId',
                  payment_methods: 'id, name, receipt_type, is_active',
                  machines: 'id, nome, ativo',
                  accounts_receivable: 'id, os_id, status, deposit_id',
                  receivable_payments: 'id, receivable_id, data_hora',
                  financial_settings: 'id, monthly_goal',
                  stock_balance: 'id, [deposit_id+product_id]',
                  stock_movements: 'id, depositoId, produtoId, origem, referenciaId, usuarioId',
                  stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
                  stock_transfer_items: 'id, transfer_id, product_id',
                  cash_sessions: 'id, deposit_id, operador_id',
                  cash_movements: 'id, cash_session_id, tipo, os_id',
                  stock_counts: 'id, deposit_id, usuario_id, tipo',
                  stock_count_items: 'id, count_id, product_id',
                  audit_logs: 'id, entidade, entidade_id, acao, criado_em',
                  financial_movements: 'id, referenciaId, formaPagamentoId',
                  receivable_titles: 'id, osId, status',
                  delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
                  driver_presence: 'driverId, status, lastSeenAt',
                  delivery_zones: 'id, deposit_id, name',
                  delivery_sectors: 'id, zone_id, name',
                  zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
                  expenses: 'id, status, due_date, category',
                  work_shifts: 'id, deposit_id, user_id, status, opened_at',
                  cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
                  shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
                  outbox_events: 'id, status, entity, action, entity_id, created_at'
                });
        
            // Alias can“nico: preferimos "receivables" como nome curto em inglˆs, mas
    // mantemos a store f¡sica existente "accounts_receivable" para compatibilidade.
    this.receivables = this.table('accounts_receivable');
  }
}

export const db = new GestaoProDB();

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};
