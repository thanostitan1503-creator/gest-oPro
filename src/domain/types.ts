
import { LucideIcon } from 'lucide-react';

export interface DashboardItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

// --- IDs & TYPES ---
export type DepositoFisicoId = 'DEP1' | 'DEP2' | 'DEP3' | string; 
export type CentroFinanceiroId = DepositoFisicoId | 'PESSOAL';
export type StatusOS = 'PENDENTE' | 'PENDENTE_ENTREGA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

// ⚠️ TIPOS DE ATENDIMENTO - APENAS 2 PERMITIDOS
export type TipoAtendimento = 'BALCAO' | 'DELIVERY';

// Status da Entrega (Máquina de Estados Simplificada)
// Fluxo: CRIADA → PENDENTE_ENTREGA → EM_ROTA → CONCLUIDA | DEVOLVIDA | CANCELADA
export type DeliveryStatus = 
  | 'CRIADA'               // O.S criada, ainda não saiu
  | 'PENDENTE_ENTREGA'     // Aguardando entregador sair
  | 'EM_ROTA'              // Entregador saiu para entrega
  | 'CONCLUIDA'            // Entrega realizada com sucesso
  | 'DEVOLVIDA'            // Entrega falhou, produto retornou
  | 'CANCELADA';           // O.S. cancelada

export type DriverStatus = 'OFFLINE' | 'DISPONIVEL' | 'PAUSADO' | 'OCUPADO';

export type ModalidadeItem = string; 
export type TipoProduto = 'GAS_CHEIO' | 'VASILHAME_VAZIO' | 'AGUA' | 'OUTROS';
export type PricingMode = 'SIMPLES' | 'TROCA' | 'COMPLETA';
export type StockMovementRule = 'SIMPLE' | 'EXCHANGE' | 'FULL';
export type UserRole = 'ADMIN' | 'COLABORADOR' | 'ENTREGADOR';

// ... (Previous types remain same) ...
export type TipoMovimentoEstoque = 'ENTRADA' | 'SAIDA' | 'SUPRIMENTO_ENTRADA' | 'SANGRIA_SAIDA' | 'AJUSTE_CONTAGEM' | 'CARGA_INICIAL';
export type TipoMovimentoFinanceiro = 'ENTRADA' | 'SAIDA';
export type OrigemMovimento = 'OS' | 'OS_CANCELAMENTO' | 'AJUSTE_MANUAL' | 'TELA_CONTAGEM_MOVIMENTACAO' | 'CONFIGURACAO' | 'DELIVERY' | 'TRANSFERENCIA';

export interface SaldoEstoque {
  depositoId: string; 
  produtoId: string;
  quantidade: number;
}

export interface MovimentoEstoque {
  id: string;
  dataHora: string; 
  depositoId: string;
  produtoId: string;
  produtoNome: string; 
  tipo: TipoMovimentoEstoque;
  quantidade: number;
  origem: OrigemMovimento;
  referenciaId?: string;
  usuarioId: string;
  usuarioNome: string;
  motivo?: string;
  meta?: any; 
}

// --- GEO LOCATION TYPES ---
export interface GeoCoordenada {
  lat: number;
  lng: number;
  timestamp?: number;
}

export interface DriverLocation {
  driverId: string;
  nome: string;
  coords: {
    lat: number;
    lng: number;
  };
  status: string;
  ultimoUpdate: number;
}

// Nova Estrutura de Presença (Substitui DriverLocation simples)
export interface DriverPresence {
  driverId: string;
  driverName: string;
  status: DriverStatus;
  lastSeenAt: number;
  lat?: number;
  lng?: number;
  deviceId?: string;
  currentJobId?: string | null;
}

// --- DELIVERY JOB (A Entrega em si) ---
export interface DeliveryJob {
  id: string;
  osId: string; // Link to ServiceOrder
  depositoId: string;
  status: DeliveryStatus;
  
  // Assignment
  assignedDriverId?: string | null;
  assignedAt?: number;
  
  // Flow Timestamps
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  refusedAt?: number;
  
  // Data Snapshot (Para performance, não depender de ler a OS toda hora)
  customerName: string;
  customerPhone?: string;
  address: {
    full: string;
    lat?: number;
    lng?: number;
  };
  itemsSummary: string; // Ex: "2x P13, 1x Água"
  totalValue: number;
  paymentMethod: string;
  observation?: string;
  
  // Failure/Refusal
  refusalReason?: string;
}

export interface DeliveryZone {
  id: string;
  depositoId?: string | null; // ✅ Padrão único (SEMPRE NULL para zonas globais)
  name: string;
  fee: number;
  color?: string | null;
  map_polygon?: any | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DeliverySector {
  id: string;
  zone_id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ZonePricing {
  id: string;
  zone_id: string;
  depositoId: string; // ✅ Padrão frontend (camelCase)
  price: number;
  created_at?: string | null;
  updated_at?: string | null;
  
  // ❌ Campos legados bloqueados
  deposit_id?: never;
  deposito_id?: never;
}

export interface ProductExchangeRule {
  id: string;
  productId: string;       // ✅ Produto cheio (EXCHANGE)
  depositoId: string;      // ✅ Depósito específico
  returnProductId: string; // ✅ Produto vazio vinculado (pode variar por depósito)
  created_at?: string | null;
  updated_at?: string | null;

  // ❌ Bloqueios legados
  product_id?: never;
  deposit_id?: never;
  deposito_id?: never;
  return_product_id?: never;
}

/**
 * Interface de Precificação de Produtos por Depósito
 * 
 * ⚠️ IMPORTANTE: Permite mesmo produto ter preços diferentes por depósito
 * - productId: ID do produto global (único)
 * - depositoId: ID do depósito específico
 * - price: Preço de venda neste depósito
 * 
 * REGRA: Unique constraint (productId + depositoId + mode)
 */
export interface ProductPricing {
  id: string;
  productId: string;         // ✅ FK para products.id
  depositoId: string;        // ✅ FK para deposits.id
  mode: PricingMode;          // ✅ Modalidade do preco
  price: number;             // ✅ Preço de venda específico deste depósito
  created_at?: string | null;
  updated_at?: string | null;
  
  // ❌ Campos legados bloqueados
  product_id?: never;
  deposit_id?: never;
  deposito_id?: never;
}

// --- ESTRUTURA FÍSICA ---

/**
 * Interface de Depósito
 * 
 * ⚠️ IMPORTANTE: Campos em português camelCase (frontend)
 * Normalização automática no dataSanitizer:
 * - nome ↔ name (Supabase)
 * - endereco ↔ address (Supabase)
 * - ativo ↔ active/is_active (Supabase)
 * - cor ↔ color (Supabase)
 */
export interface Deposit {
  id: string;
  nome: string;                      // ✅ Frontend padrão (name no Supabase)
  endereco?: string;                 // ✅ Frontend padrão (address no Supabase)
  ativo: boolean;                    // ✅ Frontend padrão (active/is_active no Supabase)
  cor?: string;                      // ✅ Frontend padrão (color no Supabase)
  require_stock_audit?: boolean;     // Config opcional
  free_shipping_min_value?: number;  // Config opcional
  
  // ❌ CAMPOS LEGADOS - NÃO USAR DIRETAMENTE!
  // Normalização automática via dataSanitizer
  name?: never;      // Impedido no TypeScript
  address?: never;   // Impedido no TypeScript
  active?: never;    // Impedido no TypeScript
  is_active?: never; // Impedido no TypeScript
  color?: never;     // Impedido no TypeScript
}

/**
 * Interface de Colaborador (Employees)
 * 
 * ⚠️ IMPORTANTE: depositoId é a ÚNICA fonte da verdade
 * Campos legados (deposit_id, deposito_id) são normalizados automaticamente
 * na camada de repository/sync.
 * 
 * REGRAS DE NEGÓCIO:
 * - GERENTE e ENTREGADOR: depositoId pode ser null (acesso global)
 * - CAIXA e ATENDENTE: depositoId é OBRIGATÓRIO (acesso local)
 */
export interface Colaborador {
  id: string;
  nome: string;
  cargo: 'GERENTE' | 'ENTREGADOR' | 'ATENDENTE' | 'CAIXA';
  depositoId: string | null; // ✅ Fonte da verdade única (camelCase)
  ativo: boolean;
  telefone?: string;
  username?: string;
  password?: string;
  permissoes: string[];
  
  // ❌ CAMPOS LEGADOS - NÃO USAR DIRETAMENTE!
  // Estes campos existem apenas para compatibilidade com dados antigos do Supabase.
  // Use sempre depositoId. A normalização é feita automaticamente.
  deposit_id?: never;   // Impedido no TypeScript
  deposito_id?: never;  // Impedido no TypeScript
}

// --- CONFIGURAÇÃO DE VENDAS ---

export interface ModalidadeVenda {
  id: string;
  codigo: string;
  nomePadrao: string;
  ordem: number;
  ativo: boolean;
}

export interface RotuloModalidade {
  id: string;
  modalidadeId: string;
  depositoId: DepositoFisicoId;
  nomeExibicao: string;
}

export interface RegraEstoqueModalidade {
  id: string;
  modalidadeId: string;
  produtoPrincipalId: string;
  produtoSaidaId: string | null;
  fatorSaida: number;
  produtoEntradaId: string | null;
  fatorEntrada: number;
}

// --- FINANÇAS ---

export interface Maquininha {
  id: string;
  nome: string;
  taxaDebito: number;
  taxaCreditoVista: number;
  taxaCreditoParcelado: number;
  depositosPermitidos: DepositoFisicoId[];
  ativo: boolean;
}

export type PaymentMethodKind = 'CASH' | 'PIX' | 'CARD' | 'FIADO' | 'BOLETO' | 'VALE' | 'OTHER';
export type PaymentReceiptType = 'IMMEDIATE' | 'DEFERRED';

export type PaymentMethod = {
  id: string;                // UUID
  name: string;              // min£sculo no banco
  method_kind: PaymentMethodKind;
  receipt_type: PaymentReceiptType;
  generates_receivable: boolean; // true = gera contas a receber
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

// Compatibilidade com partes antigas do app que ainda usam nomes em português.
// O formato canônico é PaymentMethod (campos iguais ao banco).
export type FormaPagamento = PaymentMethod & {
  Nome?: string; // legado
  nome?: string;
  tipoFluxo?: 'AVISTA' | 'APRAZO';
  geraContasReceber?: boolean;
  prazoPadraoDias?: number;
  maquininhaId?: string | null;
  taxaPercentual?: number;
  ativo?: boolean;
};

export interface MovimentoFinanceiro {
  id: string;
  dataHora: Date;
  centroFinanceiroId: CentroFinanceiroId;
  tipo: TipoMovimentoFinanceiro;
  origem: OrigemMovimento;
  referenciaId: string;
  formaPagamentoId: string;
  valorBruto: number;
  valorLiquido: number;
}

export type WorkShiftStatus = 'OPEN' | 'CLOSED' | 'DISCREPANCY';
export type CashFlowEntryCategory = 'OPENING_BALANCE' | 'SALE' | 'SANGRIA' | 'SUPRIMENTO' | 'ADJUSTMENT';
export type CashFlowEntryDirection = 'IN' | 'OUT';
export type CashFlowEntryStatus = 'POSTED' | 'PENDING' | 'CANCELLED';

export interface WorkShift {
  id: string;
  depositoId: string; // ✅ Padrão único (camelCase)
  user_id: string;
  user_name?: string | null;
  status: WorkShiftStatus;
  opened_at: number;
  closed_at?: number | null;
  opening_balance: number;
  closing_balance?: number | null;
  declared_cash?: number | null;
  declared_card?: number | null;
  declared_pix?: number | null;
  system_cash?: number | null;
  system_card?: number | null;
  system_pix?: number | null;
  notes?: string | null;
}

export interface CashFlowEntry {
  id: string;
  shift_id: string;
  depositoId: string; // ✅ Padrão único (camelCase)
  user_id: string;
  user_name?: string | null;
  category: CashFlowEntryCategory;
  direction: CashFlowEntryDirection;
  amount: number;
  status: CashFlowEntryStatus;
  created_at: number;
  reference_id?: string | null;
  reference_type?: string | null;
  payment_method_id?: string | null;
  payment_type?: 'cash' | 'card' | 'pix' | 'other';
  notes?: string | null;
  meta?: any;
}

export interface ShiftStockAudit {
  id: string;
  shift_id: string;
  deposit_id: string;
  product_id: string;
  counted_qty: number;
  system_qty: number;
  diff_qty: number;
  created_at: number;
  user_id?: string | null;
}

export interface TituloReceber {
  id: string;
  dataLancamento: Date;
  dataVencimento: Date;
  osId: string;
  clienteNome: string;
  valorOriginal: number;
  valorAberto: number;
  status: 'ABERTO' | 'PAGO' | 'CANCELADO';
}

export interface PagamentoOrdemServico {
  formaPagamentoId: string;
  valor: number;
}

export interface ResultadoProcessamento {
  sucesso: boolean;
  erros: string[];
  movimentosEstoque: MovimentoEstoque[];
  movimentosFinanceiros: MovimentoFinanceiro[];
  titulosReceber: TituloReceber[];
  osAtualizada: OrdemServico;
}

// --- ENTITIES ---

/**
 * Interface de Cliente
 * 
 * ⚠️ IMPORTANTE: depositoId é OPCIONAL para clientes
 * Clientes são entidades GLOBAIS (compartilhadas entre depósitos)
 * mas podem ser filtrados por depósito quando necessário.
 */
export interface Cliente {
  id: string;
  nome: string;
  endereco: string;
  referencia?: string;
  cpf?: string;
  dataNascimento?: string;
  telefone?: string;
  deliveryZoneId?: string | null;
  depositoId?: string | null; // ✅ Campo normalizado (opcional para clientes)
  ativo: boolean;
  criado_em: number;
  atualizado_em: number;
  
  // ❌ CAMPOS LEGADOS - NÃO USAR DIRETAMENTE!
  deposit_id?: never;
  deposito_id?: never;
}

export interface ClientePreco {
  id: string;
  clienteId: string;
  produtoId: string;
  depositoId: DepositoFisicoId | null;
  modalidade: ModalidadeItem;
  precoEspecial: number | null;
  ativo: boolean;
  atualizado_em: number;
}

export interface ClienteDescontoPendente {
  id: string;
  clienteId: string;
  depositoId: DepositoFisicoId | null;
  tipoDesconto: 'VALOR' | 'PERCENTUAL';
  valorDesconto: number;
  modalidadeAlvo?: ModalidadeItem | null;
  produtoIdAlvo?: string | null;
  usado: boolean;
  usadoEmOsId?: string | null;
  criado_em: number;
  usado_em?: number | null;
}

// --- DESPESAS ---
export type ExpenseStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  due_date: string; // Formato YYYY-MM-DD
  paid_date?: string | null; // Formato ISO se pago
  status: ExpenseStatus;
  category: string; // 'FIXA', 'VARIAVEL', 'SALARIO'
  is_fixed: boolean;
  depositoId?: string | null; // ✅ Padrão único (camelCase)
  alert_days_before: number; // 0, 1, 2, 3...
  created_at?: string | null;
  updated_at?: string | null;
}

export type Product = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  unidade: string | null;
  product_group: string | null;
  imagem_url: string | null;
  type?: string | null;

  // Numéricos padronizados
  preco_custo: number;
  preco_venda: number;
  preco_padrao: number;
  marcacao: number; // Agora bate com a coluna 'marcacao'
  
  /**
   * Preços por modalidade de venda (para produtos com movement_type='EXCHANGE')
   * - preco_troca: preço quando cliente DEVOLVE o casco (só paga o gás)
   * - preco_completa: preço quando cliente LEVA o casco (gás + vasilhame)
   */
  preco_troca?: number | null;
  preco_completa?: number | null;

  // Booleans e chaves
  track_stock?: boolean;
  is_delivery_fee?: boolean;
  movement_type?: StockMovementRule | null;
  return_product_id?: string | null;
  tracks_empties: boolean;
  ativo: boolean;
  deposit_id: string | null;
  current_stock?: number | null;
  min_stock?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

// Compatibilidade: o restante do app ainda importa `Produto`.
// O que importa agora é o formato das CHAVES do objeto (snake_case oficial).
export type Produto = Product;

export interface ItemOrdemServico {
  id: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  modalidade: ModalidadeItem;
  isPrecoEspecial?: boolean;
  /** 
   * Modo de venda escolhido no momento da venda.
   * Se o produto tem movement_type='EXCHANGE', o operador escolhe:
   * - 'EXCHANGE' (TROCA): cliente devolve casco → +1 vazio
   * - 'FULL' (COMPLETA): cliente leva casco → não entra vazio
   * Se não especificado, usa o movement_type do produto.
   */
  sale_movement_type?: StockMovementRule | null;
}

export interface LogHistoricoOS {
  data: number;
  usuario: string;
  acao: string;
  detalhe?: string;
}

export interface AlertConfig {
  minStock: Record<string, number>;
  financialDaysNotice: number;
  minMarginPercent: number;
  enabledStock: boolean;
  enabledFinancial: boolean;
  enabledMargin: boolean;
}

export interface SystemAlert {
  id: string;
  type: 'STOCK' | 'FINANCIAL' | 'MARGIN';
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  location?: string;
  details?: any;
}

export interface OrdemServico {
  id: string;
  numeroOs: string;
  depositoId: DepositoFisicoId;
  
  // Cliente Info
  clienteId: string;
  clienteNome: string;
  enderecoEntrega?: string;
  clienteTelefone?: string;
  
  // Geolocation Info (New)
  latitude?: number; 
  longitude?: number;

  // Operacional
  status: StatusOS;
  statusEntrega?: DeliveryStatus;
  tipoAtendimento: TipoAtendimento; // ⚠️ APENAS 'BALCAO' | 'DELIVERY'
  entregadorId?: string | null;
  observacoes?: string;

  // Itens e Financeiro
  itens: ItemOrdemServico[];
  pagamentos: PagamentoOrdemServico[];
  total: number;
  delivery_fee?: number;

  // Datas e Histórico
  dataHoraCriacao: number;
  dataHoraConclusao?: Date;
  updated_at: number;
  historico: LogHistoricoOS[]; 
}
