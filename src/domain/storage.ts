import { 
  MovimentoEstoque, Produto, SaldoEstoque, 
  FormaPagamento, Maquininha, ModalidadeVenda, 
  RotuloModalidade, RegraEstoqueModalidade,
  Deposito, Colaborador, AlertConfig, OrdemServico, StatusOS, LogHistoricoOS,
  DriverLocation, GeoCoordenada, DeliveryJob, DriverPresence
} from './types';
import Dexie, { Table } from 'dexie';

// --- PERSISTÊNCIA ROBUSTA (IndexedDB + Cache) ---

// Definição do Banco de Dados
class GestaoProDB extends Dexie {
  kv!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('GestaoProDB');
    this.version(1).stores({
      kv: 'key' // Armazenamento chave-valor simples para substituir localStorage de forma robusta
    });
  }
}

export const db = new GestaoProDB();

// Cache em Memória (Espelho Síncrono do Banco)
// Isso garante que a UI não quebre esperando Promises
const MEMORY_CACHE: Record<string, any> = {};

// Inicialização do Sistema (Deve ser chamado no App start)
export const initStorage = async () => {
  try {
    const allData = await db.kv.toArray();
    allData.forEach(item => {
      MEMORY_CACHE[item.key] = item.value;
    });
    console.log('Storage: Sistema hidratado com sucesso.', Object.keys(MEMORY_CACHE).length, 'chaves carregadas.');
    return true;
  } catch (e) {
    console.error('Storage: Erro fatal ao iniciar banco de dados.', e);
    return false;
  }
};

// Substitutos Robustos para localStorage
const getJSON = <T>(key: string, fallback: T): T => {
  // Lê da memória (Síncrono, Instantâneo)
  if (Object.prototype.hasOwnProperty.call(MEMORY_CACHE, key)) {
    return MEMORY_CACHE[key] as T;
  }
  return fallback;
};

const setJSON = (key: string, value: any) => {
  // 1. Atualiza memória (UI reage rápido)
  MEMORY_CACHE[key] = value;
  // 2. Persiste no Disco (Assíncrono, Seguro)
  db.kv.put({ key, value }).catch(e => console.error(`Storage: Falha ao salvar ${key}`, e));
};

// --- CHAVES DO SISTEMA ---
const KEYS = {
  PRODUCTS: 'gp_db_products',
  STOCK: 'gp_db_stock',
  MOVEMENTS: 'gp_db_movements_audit',
  PAYMENT_METHODS: 'gp_db_payment_methods',
  MACHINES: 'gp_db_machines',
  ORDERS: 'gp_db_orders',
  DRIVER_LOCATIONS: 'gp_db_driver_locations',
  DELIVERY_JOBS: 'gp_db_delivery_jobs',
  DRIVER_PRESENCE: 'gp_db_driver_presence',
  SALES_MODALITIES: 'gp_db_sales_modalities',
  MODALITY_LABELS: 'gp_db_modality_labels',
  STOCK_RULES: 'gp_db_stock_rules',
  ALERTS_CONFIG: 'gp_db_alerts_config',
  DEPOSITS: 'gp_db_deposits',
  EMPLOYEES: 'gp_db_employees',
  CLIENTS: 'gp_db_clients',
  CLIENT_PRICES: 'gp_db_client_prices',
  CLIENT_DISCOUNTS: 'gp_db_client_discounts',
  THEME_BG_IMAGE: 'gp_ui_bg_image',
  THEME_BG_OPACITY: 'gp_ui_bg_opacity'
};

// --- SYSTEM MANAGEMENT ---

export const performFactoryReset = async () => {
  // Limpa Memória
  for (const key in MEMORY_CACHE) delete MEMORY_CACHE[key];
  // Limpa Banco
  await db.kv.clear();
  // Limpa Sessão LocalStorage (tokens, theme)
  localStorage.clear();
  console.log('Storage: RESET DE FÁBRICA EXECUTADO.');
};

// Verifica se existe algum dado crítico que impeça exclusão física
export const checkEntityDependencies = (entityId: string, entityType: 'USER' | 'DEPOSIT' | 'PRODUCT'): boolean => {
  const orders = getOrders();
  const movements = getMovements();

  if (entityType === 'USER') {
    const hasOrder = orders.some(o => o.entregadorId === entityId); // Verifica entregador
    // Verifica logs de histórico dentro das ordens
    const hasHistory = orders.some(o => o.historico?.some(h => h.usuario === entityId)); // Simplificado
    const hasMovement = movements.some(m => m.usuarioId === entityId);
    return hasOrder || hasMovement;
  }

  if (entityType === 'DEPOSIT') {
    const hasStock = getStock(entityId).some(s => s.quantidade > 0);
    const hasOrder = orders.some(o => o.depositoId === entityId);
    return hasStock || hasOrder;
  }

  return false;
};

// --- AUTH ---

export const authenticateUser = (user: string, pass: string): Colaborador | null => {
  const employees = getEmployees();
  
  // Sanitização Robusta para Mobile
  const inputUser = user.trim().toLowerCase();
  const inputPass = pass.trim();

  const found = employees.find(e => 
    e.username?.trim().toLowerCase() === inputUser && 
    e.password?.trim() === inputPass && 
    e.ativo
  );
  return found || null;
};

// --- PRODUCTS ---

export const getProducts = (): Produto[] => {
  return getJSON<Produto[]>(KEYS.PRODUCTS, []);
};

export const saveProducts = (products: Produto[]) => {
  setJSON(KEYS.PRODUCTS, products);
};

// --- STOCK ---

type StockMap = Record<string, Record<string, number>>; 

export const getStock = (depositoId: string): SaldoEstoque[] => {
  const stockMap = getJSON<StockMap>(KEYS.STOCK, {});
  const depositoStock = stockMap[depositoId] || {};
  
  const products = getProducts();
  return products.map(p => ({
    depositoId,
    produtoId: p.id,
    quantidade: depositoStock[p.id] || 0
  }));
};

export const getStockMap = (): StockMap => {
  return getJSON<StockMap>(KEYS.STOCK, {});
}

export const updateStock = (depositoId: string, produtoId: string, delta: number) => {
  const stockMap = getJSON<StockMap>(KEYS.STOCK, {});
  if (!stockMap[depositoId]) stockMap[depositoId] = {};
  const current = stockMap[depositoId][produtoId] || 0;
  stockMap[depositoId][produtoId] = Math.max(0, current + delta); 
  setJSON(KEYS.STOCK, stockMap);
};

export const addMovement = (mov: MovimentoEstoque) => {
  const movements = getJSON<MovimentoEstoque[]>(KEYS.MOVEMENTS, []);
  movements.unshift(mov); 
  setJSON(KEYS.MOVEMENTS, movements);
};

export const getMovements = (): MovimentoEstoque[] => {
  return getJSON<MovimentoEstoque[]>(KEYS.MOVEMENTS, []);
};

// --- ORDERS ---

export const getOrders = (): OrdemServico[] => {
  return getJSON<OrdemServico[]>(KEYS.ORDERS, []);
};

export const saveOrder = (os: OrdemServico, logEntry?: LogHistoricoOS) => {
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === os.id);
  let finalOrder = os;

  if (index >= 0) {
    const existing = orders[index];
    finalOrder = {
      ...existing,
      ...os,
      dataHoraCriacao: existing.dataHoraCriacao,
      historico: existing.historico || []
    };
  } else {
    if (!finalOrder.historico) finalOrder.historico = [];
  }

  if (logEntry) {
    finalOrder.historico.unshift(logEntry);
  }

  if (index >= 0) {
    orders[index] = finalOrder;
  } else {
    orders.unshift(finalOrder);
  }
  
  setJSON(KEYS.ORDERS, orders);
  return finalOrder;
};

export const updateOrderStatus = (osId: string, status: StatusOS, motivo?: string, usuario: string = 'Sistema') => {
  const orders = getOrders();
  const order = orders.find(o => o.id === osId);
  if (order) {
    const prevStatus = order.status;
    order.status = status;
    order.updated_at = Date.now();
    if (status === 'CONCLUIDA') {
      order.dataHoraConclusao = new Date();
    }
    if (!order.historico) order.historico = [];
    order.historico.unshift({
      data: Date.now(),
      usuario: usuario,
      acao: 'Mudança de Status',
      detalhe: `De ${prevStatus} para ${status}. ${motivo ? `(${motivo})` : ''}`
    });
    setJSON(KEYS.ORDERS, orders);
  }
  return order;
};

// --- DRIVER LOCATION & PRESENCE ---

export const saveDriverLocation = (location: DriverLocation) => {
  const locations = getJSON<DriverLocation[]>(KEYS.DRIVER_LOCATIONS, []);
  const index = locations.findIndex(l => l.driverId === location.driverId);
  
  if (index >= 0) {
    locations[index] = location;
  } else {
    locations.push(location);
  }
  setJSON(KEYS.DRIVER_LOCATIONS, locations);
};

export const getDriverLocations = (): DriverLocation[] => {
  return getJSON<DriverLocation[]>(KEYS.DRIVER_LOCATIONS, []);
};

export const getDriverPresenceList = (): DriverPresence[] => {
  return getJSON<DriverPresence[]>(KEYS.DRIVER_PRESENCE, []);
};

export const saveDriverPresence = (presence: DriverPresence) => {
  const list = getDriverPresenceList();
  const idx = list.findIndex(p => p.driverId === presence.driverId);
  if (idx >= 0) {
    list[idx] = presence;
  } else {
    list.push(presence);
  }
  setJSON(KEYS.DRIVER_PRESENCE, list);
};

// --- DELIVERY JOBS ---

export const getDeliveryJobs = (): DeliveryJob[] => {
  return getJSON<DeliveryJob[]>(KEYS.DELIVERY_JOBS, []);
};

export const saveDeliveryJob = (job: DeliveryJob) => {
  const jobs = getDeliveryJobs();
  const idx = jobs.findIndex(j => j.id === job.id);
  if (idx >= 0) {
    jobs[idx] = job;
  } else {
    jobs.push(job);
  }
  setJSON(KEYS.DELIVERY_JOBS, jobs);
};

// --- CONFIGURATIONS ---

export const getSalesModalities = (): ModalidadeVenda[] => {
  return getJSON<ModalidadeVenda[]>(KEYS.SALES_MODALITIES, []);
};

export const saveSalesModalities = (mods: ModalidadeVenda[]) => {
  setJSON(KEYS.SALES_MODALITIES, mods);
};

export const getModalityLabels = (): RotuloModalidade[] => {
  return getJSON<RotuloModalidade[]>(KEYS.MODALITY_LABELS, []);
};

export const saveModalityLabels = (labels: RotuloModalidade[]) => {
  setJSON(KEYS.MODALITY_LABELS, labels);
};

export const getStockRules = (): RegraEstoqueModalidade[] => {
  return getJSON<RegraEstoqueModalidade[]>(KEYS.STOCK_RULES, []);
};

export const saveStockRules = (rules: RegraEstoqueModalidade[]) => {
  setJSON(KEYS.STOCK_RULES, rules);
};

export const getPaymentMethods = (): FormaPagamento[] => {
  return getJSON<FormaPagamento[]>(KEYS.PAYMENT_METHODS, []);
};

export const savePaymentMethods = (methods: FormaPagamento[]) => {
  setJSON(KEYS.PAYMENT_METHODS, methods);
};

export const getMachines = (): Maquininha[] => {
  return getJSON<Maquininha[]>(KEYS.MACHINES, []);
};

export const saveMachines = (machines: Maquininha[]) => {
  setJSON(KEYS.MACHINES, machines);
};

// --- INFRASTRUCTURE (DEPOSITS & EMPLOYEES) ---

export const getDeposits = (): Deposito[] => {
  return getJSON<Deposito[]>(KEYS.DEPOSITS, []);
};

export const saveDeposits = (deposits: Deposito[]) => {
  setJSON(KEYS.DEPOSITS, deposits);
};

export const getEmployees = (): Colaborador[] => {
  return getJSON<Colaborador[]>(KEYS.EMPLOYEES, []);
};

export const saveEmployees = (employees: Colaborador[]) => {
  setJSON(KEYS.EMPLOYEES, employees);
};

// --- THEME BACKGROUND ---

export const getThemeBackgroundImage = (): string | null => {
  const value = getJSON<string | null>(KEYS.THEME_BG_IMAGE, null);
  return value ?? null;
};

export const setThemeBackgroundImage = async (image: string | null) => {
  try {
    if (!image) {
      delete MEMORY_CACHE[KEYS.THEME_BG_IMAGE];
      await db.kv.delete(KEYS.THEME_BG_IMAGE).catch(() => undefined);
      return;
    }
    await db.kv.put({ key: KEYS.THEME_BG_IMAGE, value: image });
    MEMORY_CACHE[KEYS.THEME_BG_IMAGE] = image;
  } catch (err) {
    console.error('Storage: Falha ao salvar imagem de fundo', err);
    await db.kv.delete(KEYS.THEME_BG_IMAGE).catch(() => undefined);
    delete MEMORY_CACHE[KEYS.THEME_BG_IMAGE];
    throw err;
  }
};

export const getThemeBackgroundOpacity = (): number => {
  const raw = getJSON<number | string | null>(KEYS.THEME_BG_OPACITY, 0.35);
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(value as number)) return 0.35;
  return Math.min(1, Math.max(0, value as number));
};

export const setThemeBackgroundOpacity = (value: number) => {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.35;
  setJSON(KEYS.THEME_BG_OPACITY, clamped);
};

// --- ALERTS ---

const DEFAULT_ALERTS_CONFIG: AlertConfig = {
  minStock: {},
  financialDaysNotice: 1,
  minMarginPercent: 15,
  enabledStock: true,
  enabledFinancial: true,
  enabledMargin: true
};

export const getAlertsConfig = (): AlertConfig => {
  const config = getJSON<AlertConfig>(KEYS.ALERTS_CONFIG, DEFAULT_ALERTS_CONFIG);
  return { ...DEFAULT_ALERTS_CONFIG, ...config };
};

export const saveAlertsConfig = (config: AlertConfig) => {
  setJSON(KEYS.ALERTS_CONFIG, config);
};
