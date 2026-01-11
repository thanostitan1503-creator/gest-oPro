import React, { useState, useMemo, useEffect } from 'react';
// ⚠️ REMOVIDO v3.0: useLiveQuery (use useState + useEffect + Services)
import { 
  X, Save, Plus, Search, Trash2, 
  User, Cylinder, ShoppingCart, CreditCard, Banknote, Coins,
  ClipboardList, Clock, CheckCircle2, Truck, Ban, MoreVertical,
  Filter, ArrowRight, Minus, Package, Edit2, MapPin, Bike, History,
  Activity, Check
} from 'lucide-react';
import L from 'leaflet';
import { MapContainer, Pane, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { NewClientModal } from './NewClientModal';
import { ServiceOrderItems } from './ServiceOrderItems';
import { Cliente, Produto, OrdemServico, ItemOrdemServico, StatusOS, Colaborador, LogHistoricoOS } from '@/domain/types';
import { PaymentMethod, PaymentMethodDepositConfig } from '@/types';
import { getOrders } from '@/utils/legacyHelpers';
import { supabase } from '@/utils/supabaseClient';
import { normalizeDateForSupabase } from '@/utils/date';
import {
  clientService,
  loadClientSpecialPrices,
  productService,
  depositService,
  employeeService,
  serviceOrderService,
  financialService,
  listPaymentMethods,
  listPaymentMethodDepositConfigs,
  type ClientSpecialPriceMap,
  type CompleteServiceOrder,
  type NewServiceOrder as ServiceOrderInsert,
  type NewServiceOrderItem,
  type NewServiceOrderPayment,
} from '@/services';
import type { Deposit as DepositRow } from '@/services/depositService';

type EmployeeRow = {
  id: string;
  name: string;
  role?: string | null;
  deposit_id?: string | null;
  active?: boolean;
  username?: string | null;
  permissions?: string[];
};
import { toast } from 'sonner';
import { SYSTEM_USER_ID } from '@/constants/system';

// Stub para db e useLiveQuery
const db: any = {
  payment_methods: { filter: () => ({ toArray: async () => [] }) },
  employees: { filter: () => ({ toArray: async () => [] }) },
  deposits: { filter: () => ({ toArray: async () => [] }) },
  delivery_zones: { toArray: async () => [] },
  zone_pricing: { toArray: async () => [] },
  service_orders: { get: async () => null, update: async () => {} },
};

const useLiveQuery = (fn: any, deps?: any) => {
  const [data, setData] = useState<any>(undefined);
  useEffect(() => {
    fn().then((result: any) => setData(result || [])).catch(() => setData([]));
  }, deps || []);
  return data;
};

// Funções auxiliares para NewServiceOrder
const listServiceOrders = async () => {
  return await getOrders();
};

const normalizeMethodKind = (value?: string | null): PaymentMethod['method_kind'] => {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'CASH' || upper === 'DINHEIRO') return 'CASH';
  if (upper === 'PIX') return 'PIX';
  if (upper === 'CARD' || upper === 'CARTAO' || upper === 'CREDITO' || upper === 'DEBITO') return 'CARD';
  if (upper === 'FIADO') return 'FIADO';
  if (upper === 'BOLETO') return 'BOLETO';
  if (upper === 'VALE') return 'VALE';
  return 'OTHER';
};

const buildFullAddress = (
  street?: string | null,
  neighborhood?: string | null,
  fallback?: string | null
) => {
  const parts = [street?.trim(), neighborhood?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(' - ');
  return (fallback ?? '').trim();
};

const getClientAddress = (client?: Partial<Cliente> | null) => {
  if (!client) return '';
  const street = client.streetAddress ?? '';
  const neighborhood = client.neighborhood ?? '';
  if (street.trim() || neighborhood.trim()) {
    return buildFullAddress(street, neighborhood, '');
  }
  return (client.endereco ?? '').trim();
};


const listEmployees = async (): Promise<Colaborador[]> => {
  const { data, error } = await supabase.from('employees').select('*').eq('is_active', true);
  if (error) throw error;
  return (data || []).map((e: any) => ({
    id: e.id,
    nome: e.name,
    cargo: e.role,
    depositoId: e.deposit_id,
    ativo: e.is_active,
    username: e.username,
    permissoes: e.permissions || [],
  }));
};

const getEmployees = (): Colaborador[] => {
  try {
    const stored = localStorage.getItem('gp_employees');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const listClients = async (): Promise<Cliente[]> => {
  const data = await clientService.getAll();
  return (data || []).map((c) => {
    const endereco = buildFullAddress(c.street_address, c.neighborhood, c.address);
    return {
      id: c.id,
      nome: c.name,
      endereco,
      streetAddress: c.street_address ?? c.address ?? '',
      neighborhood: c.neighborhood ?? '',
      deliverySectorId: c.delivery_sector_id ?? null,
      telefone: c.phone ?? undefined,
      cpf: c.cpf ?? undefined,
      referencia: c.reference ?? undefined,
      dataNascimento: c.birth_date ?? undefined,
      deliveryZoneId: c.delivery_zone_id ?? null,
      ativo: c.is_active ?? c.active ?? true,
    };
  });
};

const upsertClient = async (client: Partial<Cliente>) => {
  const nowIso = new Date().toISOString();
  const birth = normalizeDateForSupabase(client.dataNascimento);
  const endereco = buildFullAddress(client.streetAddress, client.neighborhood, client.endereco);

  const basePayload = {
    name: client.nome || '',
    address: endereco || null,
    street_address: client.streetAddress?.trim() || null,
    neighborhood: client.neighborhood?.trim() || null,
    delivery_sector_id: client.deliverySectorId ?? null,
    phone: client.telefone || null,
    cpf: client.cpf || null,
    reference: client.referencia || null,
    birth_date: birth,
    delivery_zone_id: client.deliveryZoneId ?? null,
    is_active: client.ativo ?? true,
    updated_at: nowIso,
  };

  if (client.id) {
    await clientService.update(client.id, basePayload);
    return;
  }

  await clientService.create({
    ...basePayload,
    created_at: nowIso,
  });
};

const createProduct = async (product: any): Promise<Produto> => {
  // Evita enviar colunas que não existem no schema do Supabase
  if (product && typeof product === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete product.current_stock;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete product.min_stock;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete product.markup;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete product.tracks_empties;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete product.is_delivery_fee;
  }
  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw error;
  return mapProductRowToProduto(data);
};

const updateProduct = async (id: string, updates: any): Promise<Produto> => {
  // Evita enviar colunas que não existem no schema do Supabase
  if (updates && typeof updates === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete updates.current_stock;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete updates.min_stock;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete updates.markup;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete updates.tracks_empties;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete updates.is_delivery_fee;
  }
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return mapProductRowToProduto(data);
};

const upsertServiceOrder = async (
  order: ServiceOrderInsert,
  items: NewServiceOrderItem[],
  payments: NewServiceOrderPayment[]
) => {
  await serviceOrderService.upsertWithDetails({ order, items, payments });
};

const updateServiceOrderStatus = async (
  id: string,
  status: StatusOS,
  reason?: string
) => {
  if (status === 'CONCLUIDA') {
    await serviceOrderService.complete(id);
    return;
  }
  if (status === 'CANCELADA') {
    await serviceOrderService.cancel(id, reason ?? 'Cancelamento manual');
    return;
  }
  await serviceOrderService.updateStatus(id, status);
};

const normalizeDepositId = (value: any) => {
  if (!value) return { depositoId: null };
  if (typeof value === 'string') return { depositoId: value };
  if (typeof value === 'object') {
    if ('depositoId' in value) return { depositoId: (value as any).depositoId ?? null };
    if ('deposit_id' in value) return { depositoId: (value as any).deposit_id ?? null };
    if ('depositId' in value) return { depositoId: (value as any).depositId ?? null };
  }
  return { depositoId: String(value) };
};

const mapProductRowToProduto = (p: any): Produto => ({
  id: p.id,
  codigo: p.code,
  nome: p.name,
  descricao: p.description,
  tipo: p.type,
  unidade: p.unit,
  preco_venda: p.sale_price,
  preco_custo: p.cost_price,
  preco_troca: p.exchange_price,
  preco_completa: p.full_price,
  movement_type: p.movement_type,
  return_product_id: p.return_product_id,
  track_stock: p.track_stock,
  ativo: p.is_active,
  depositoId: p.deposit_id,
  product_group: p.product_group,
  image_url: p.image_url,
});

const mapCompleteServiceOrderToDomain = (order: CompleteServiceOrder): OrdemServico => ({
  id: order.id,
  numeroOs: order.order_number,
  depositoId: order.deposit_id,
  clienteId: order.client_id ?? '',
  clienteNome: order.client_name ?? '',
  clienteTelefone: order.client_phone ?? undefined,
  enderecoEntrega: order.delivery_address ?? '',
  tipoAtendimento: (order.service_type as any) ?? 'DELIVERY',
  status: (order.status as StatusOS) ?? 'PENDENTE',
  statusEntrega: order.delivery_status ?? undefined,
  entregadorId: order.driver_id ?? null,
  observacoes: '',
  itens: (order.items || []).map((item) => ({
    id: item.id,
    produtoId: item.product_id,
    quantidade: item.quantity,
    precoUnitario: item.unit_price,
    modalidade: item.modality ?? 'VENDA',
    sale_movement_type: item.sale_movement_type ?? null,
  })),
  pagamentos: (order.payments || []).map((payment) => ({
    payment_method_id: payment.payment_method_id,
    payment_method_name: payment.payment_method_name ?? null,
    machine_id: payment.machine_id ?? null,
    machine_name: payment.machine_name ?? null,
    amount: payment.amount,
  })) as any,
  total: order.total ?? 0,
  delivery_fee: order.delivery_fee ?? 0,
  dataHoraCriacao: order.created_at ? new Date(order.created_at).getTime() : Date.now(),
  dataHoraConclusao: order.completed_at ? new Date(order.completed_at).getTime() : undefined,
  historico: [],
});

const fetchDeliveryFeeProduct = async (): Promise<Produto | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`product_group.eq.${DELIVERY_FEE_GROUP},code.eq.${DELIVERY_FEE_GROUP},name.ilike.%${DELIVERY_FEE_NAME}%`)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? mapProductRowToProduto(row) : null;
};

const createDeliveryJobFromOS = async (order: OrdemServico) => {
  console.log('TODO: Criar delivery job para OS', order.id);
};

const getSessionUserName = () => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('gp_session');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    return parsed?.nome || parsed?.username || parsed?.id || null;
  } catch {
    return null;
  }
};

const DELIVERY_FEE_GROUP = 'delivery_fee';
const DELIVERY_FEE_NAME = 'Taxa de entrega';
const isDeliveryFeeProduct = (prod: any) => {
  const group = String(prod?.product_group ?? prod?.codigo ?? '').toLowerCase();
  if (group === DELIVERY_FEE_GROUP) return true;
  const name = String(prod?.nome ?? '').toLowerCase();
  return name === DELIVERY_FEE_NAME.toLowerCase();
};
const isServiceProduct = (prod: any) => {
  if (isDeliveryFeeProduct(prod)) return true;
  const track = prod?.track_stock ?? prod?.trackStock;
  if (track === false) return true;
  return false;
};
type LatLngTuple = [number, number];

const HUB_COORDS = { lat: -17.7915, lng: -50.9197 };

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const toLatLngTuple = (point: any): LatLngTuple | null => {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }
  if (typeof point === 'object') {
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }
  return null;
};

const normalizePolygon = (raw: any): LatLngTuple[][] | null => {
  if (!raw) return null;
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(data) || data.length === 0) return null;

  const firstAsPoint = toLatLngTuple(data[0]);
  if (firstAsPoint) {
    const ring = data.map(toLatLngTuple).filter(Boolean) as LatLngTuple[];
    return ring.length ? [ring] : null;
  }

  const rings: LatLngTuple[][] = [];
  for (const ringRaw of data) {
    if (!Array.isArray(ringRaw)) continue;
    const ring = ringRaw.map(toLatLngTuple).filter(Boolean) as LatLngTuple[];
    if (ring.length) rings.push(ring);
  }

  return rings.length ? rings : null;
};

const findZoneMatch = (value: string, zones: any[], sectors: any[]) => {
  const normalized = normalizeText(value || '');
  if (!normalized) return null;

  const sectorMatch = sectors
    .map((sector) => ({ sector, key: normalizeText(sector?.nome || '') }))
    .filter((item) => item.key.length > 2 && normalized.includes(item.key))
    .sort((a, b) => b.key.length - a.key.length)[0];

  if (sectorMatch?.sector) {
    const zone = zones.find((z) => z.id === sectorMatch.sector.zone_id) ?? null;
    if (zone) return { zone, sector: sectorMatch.sector, source: 'setor' };
  }

  const zoneMatch = zones
    .map((zone) => ({ zone, key: normalizeText(zone?.nome || '') }))
    .filter((item) => item.key.length > 2 && normalized.includes(item.key))
    .sort((a, b) => b.key.length - a.key.length)[0];

  if (zoneMatch?.zone) {
    return { zone: zoneMatch.zone, sector: null, source: 'zona' };
  }

  return null;
};

const MiniMapFit: React.FC<{
  polygons: LatLngTuple[][][];
  activePolygon: LatLngTuple[][] | null;
}> = ({ polygons, activePolygon }) => {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    let hasBounds = false;
    const all = [...polygons, ...(activePolygon ? [activePolygon] : [])];
    all.forEach((polygon) => {
      if (!polygon || !polygon.length) return;
      const layer = L.polygon(polygon as any);
      bounds.extend(layer.getBounds());
      hasBounds = true;
    });
    if (hasBounds) {
      map.fitBounds(bounds, { padding: [12, 12] });
    }
  }, [polygons, activePolygon, map]);

  return null;
};

const MiniMapResizeHandler: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const refresh = () => {
      const container = map.getContainer?.();
      if (!container || !container.isConnected) return;
      if (!(map as any)._loaded) return;
      map.invalidateSize();
    };
    map.whenReady(() => refresh());
    requestAnimationFrame(refresh);
    const timeoutId = setTimeout(refresh, 120);
    const longTimeoutId = setTimeout(refresh, 360);
    const handleResize = () => refresh();
    window.addEventListener('resize', handleResize);
    let observer: ResizeObserver | null = null;
    const container = map.getContainer();
    if (typeof ResizeObserver !== 'undefined' && container) {
      observer = new ResizeObserver(() => refresh());
      observer.observe(container);
    }

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(longTimeoutId);
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [map]);

  return null;
};
// Form principal de criação/edição de O.S (usa repositórios atualizados)

// ----------------------------------------------------------------------
// HELPER: TIMELINE VISUALIZER
// ----------------------------------------------------------------------
const Timeline: React.FC<{ logs: LogHistoricoOS[] }> = ({ logs }) => {
  if (!logs || logs.length === 0) return <div className="text-xs text-txt-muted italic">Sem histórico</div>;

  return (
    <div className="space-y-4 relative pl-2">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-bdr"></div>
      {logs.map((log, i) => (
        <div key={i} className="relative flex gap-3 items-start group">
          <div className="w-6 h-6 rounded-full bg-surface border-2 border-bdr flex items-center justify-center shrink-0 z-10 group-hover:border-primary transition-colors">
             <div className="w-2 h-2 rounded-full bg-txt-muted group-hover:bg-primary transition-colors"></div>
          </div>
          <div>
             <p className="text-xs font-bold text-txt-main">{log.acao}</p>
             <p className="text-[10px] text-txt-muted">{log.detalhe}</p>
             <div className="flex gap-2 mt-1">
                <span className="text-[9px] bg-app px-1.5 py-0.5 rounded border border-bdr text-txt-muted uppercase font-bold">{log.usuario}</span>
                <span className="text-[9px] text-txt-muted">{new Date(log.data).toLocaleString()}</span>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ----------------------------------------------------------------------
// HELPER: CRONÔMETRO DE O.S.
// ----------------------------------------------------------------------
const OsTimer: React.FC<{ createdAt: number; status: StatusOS }> = ({ createdAt, status }) => {
  const [elapsed, setElapsed] = useState('');
  const [urgencyColor, setUrgencyColor] = useState('text-green-600');

  useEffect(() => {
    if (status === 'CONCLUIDA' || status === 'CANCELADA') {
      setElapsed('--:--');
      return;
    }

    const update = () => {
      const now = Date.now();
      const diff = now - createdAt;
      
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const str = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setElapsed(str);

      if (minutes >= 30) setUrgencyColor('text-red-600 animate-pulse');
      else if (minutes >= 15) setUrgencyColor('text-amber-500');
      else setUrgencyColor('text-green-600');
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  return (
    <div className={`font-mono font-bold text-sm flex items-center gap-1 ${urgencyColor} bg-surface px-2 py-1 rounded border border-bdr`}>
      <Clock className="w-3 h-3" />
      {elapsed}
    </div>
  );
};

// ----------------------------------------------------------------------
// SUB-COMPONENT: ORDER CREATION/EDIT FORM
// ----------------------------------------------------------------------

interface OrderCreationFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  initialData?: OrdemServico | null; // Para edição
  currentUser?: Colaborador;
}

interface OrderItem {
  id: string; 
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  tipo: string;
  /** Modo de venda escolhido: EXCHANGE (troca) ou FULL (completa) */
  sale_movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null;
  priceSource?: 'AUTO' | 'CLIENT_SPECIAL' | 'MANUAL';
  isManualPrice?: boolean;
}

interface PaymentItem {
  id: string;
  methodId: string;
  methodName: string;
  value: number;
  methodKind: PaymentMethod['method_kind'];
}

const OrderCreationForm: React.FC<OrderCreationFormProps> = ({ onCancel, onSuccess, initialData, currentUser }) => {
  // ... (Full component code is large, updating the render part) ...
  const [products, setProducts] = useState<Produto[]>([]);
  const [paymentMethodsDB, setPaymentMethodsDB] = useState<PaymentMethod[]>([]);
  const [paymentMethodConfigs, setPaymentMethodConfigs] = useState<PaymentMethodDepositConfig[]>([]);
  const [dbClients, setDbClients] = useState<Cliente[]>([]);
  const [availableDeposits, setAvailableDeposits] = useState<Deposito[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Colaborador[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [prodsRaw, methods, clients, configs] = await Promise.all([
        productService.getAll().catch(() => []),
        listPaymentMethods().catch(() => []),
        listClients(),
        listPaymentMethodDepositConfigs().catch(() => []),
      ]);

      let nextProducts = Array.isArray(prodsRaw) ? prodsRaw : [];
      let deliveryFeeProduct =
        nextProducts.find((p) => (p.product_group ?? '') === DELIVERY_FEE_GROUP) ||
        nextProducts.find((p) => (p.codigo ?? '') === DELIVERY_FEE_GROUP) ||
        nextProducts.find((p) => (p.nome ?? '').toLowerCase() === DELIVERY_FEE_NAME.toLowerCase()) ||
        null;

      if (!deliveryFeeProduct) {
        try {
          deliveryFeeProduct = await fetchDeliveryFeeProduct();
          if (deliveryFeeProduct) {
            nextProducts = [...nextProducts, deliveryFeeProduct];
          }
        } catch (err) {
          console.error('Erro ao buscar produto de taxa de entrega:', err);
        }
      }

      if (deliveryFeeProduct && isDeliveryFeeProduct(deliveryFeeProduct)) {
        const normalized = normalizeDepositId(deliveryFeeProduct);
        const needsFix =
          !isServiceProduct(deliveryFeeProduct) ||
          normalized.depositoId !== null ||
          (deliveryFeeProduct as any).product_group !== DELIVERY_FEE_GROUP ||
          (deliveryFeeProduct as any).codigo !== DELIVERY_FEE_GROUP ||
          deliveryFeeProduct.preco_venda !== 0 ||
          deliveryFeeProduct.preco_custo !== 0;
        if (needsFix) {
          try {
            const updated = await updateProduct(deliveryFeeProduct.id, {
              name: DELIVERY_FEE_NAME,
              type: 'OUTROS',
              unit: 'serv',
              product_group: DELIVERY_FEE_GROUP,
              code: DELIVERY_FEE_GROUP,
              deposit_id: null,
              cost_price: 0,
              sale_price: 0,
              is_active: true,
              track_stock: false,
            } as any);
            deliveryFeeProduct = updated;
            nextProducts = nextProducts.map((p) => (p.id === updated.id ? updated : p));
          } catch (err) {
            console.error('Erro ao atualizar servico de taxa de entrega:', err);
          }
        }
      }

      if (!deliveryFeeProduct) {
        try {
          deliveryFeeProduct = await createProduct({
            name: DELIVERY_FEE_NAME,
            type: 'OUTROS',
            unit: 'serv',
            product_group: DELIVERY_FEE_GROUP,
            code: DELIVERY_FEE_GROUP,
            deposit_id: null,
            sale_price: 0,
            cost_price: 0,
            is_active: true,
            track_stock: false,
          } as any);
          nextProducts = [...nextProducts, deliveryFeeProduct];
        } catch (err) {
          console.error('Erro ao criar produto de taxa de entrega:', err);
          try {
            const fallback = await fetchDeliveryFeeProduct();
            if (fallback) {
              deliveryFeeProduct = fallback;
              const exists = nextProducts.some((p) => p.id === fallback.id);
              nextProducts = exists ? nextProducts : [...nextProducts, fallback];
            }
          } catch (innerErr) {
            console.error('Erro ao recuperar produto de taxa apos falha de criacao:', innerErr);
          }
        }
      }

      if (!alive) return;
      setProducts(nextProducts);
      setPaymentMethodsDB(methods);
      setPaymentMethodConfigs(configs);
      setDbClients(clients);
      setDeliveryFeeProductId(deliveryFeeProduct?.id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Carrega depósitos e entregadores via serviços
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [depsRaw, empsRaw] = await Promise.all([
          depositService.getAll(),
          employeeService.getAll(),
        ]);

        if (!mounted) return;

        const deps = (depsRaw || []).map((d: DepositRow) => ({
          id: d.id,
          nome: d.name,
          ativo: d.active ?? d.is_active ?? false,
          endereco: d.address,
          cor: d.color,
        } as Deposito)).filter((d) => currentUser?.depositoId ? d.id === currentUser.depositoId : d.ativo !== false);

        const emps = (empsRaw || []).map((e: EmployeeRow) => ({
          id: e.id,
          nome: e.name,
          cargo: e.role,
          depositoId: e.deposit_id ?? null,
          ativo: e.active ?? false,
          username: e.username ?? undefined,
          permissoes: e.permissions || [],
        } as Colaborador));

        const drivers = emps.filter((e) => {
          const cargo = String(e.cargo ?? '').toUpperCase();
          const isDriver = cargo.includes('ENTREG') || cargo.includes('MOTOR');
          if (!isDriver) return false;
          if (currentUser?.depositoId) {
            return e.depositoId === currentUser.depositoId || e.depositoId === null;
          }
          return true;
        });

        setAvailableDeposits(deps);
        setAvailableDrivers(drivers);
      } catch (err) {
        console.error('Erro ao carregar depósitos/entregadores', err);
        toast.error('Erro ao carregar depósitos');
        if (mounted) {
          setAvailableDeposits([]);
          setAvailableDrivers([]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentUser?.depositoId]);

  // Live queries for deposits and drivers to populate selects
  // availableDrivers e availableDeposits carregados via services (ver useEffect acima)
  const deliveryZones = useLiveQuery(() => db.delivery_zones?.toArray(), []) || [];
  const deliverySectors = useLiveQuery(() => db.delivery_zones?.toArray(), []) || [];
  const zonePricing = useLiveQuery(() => db.zone_pricing?.toArray(), []) || [];
  const deliveryZonesById = useMemo(() => {
    const map = new Map<string, any>();
    deliveryZones.forEach((zone: any) => {
      if (zone?.id) map.set(zone.id, zone);
    });
    return map;
  }, [deliveryZones]);

  // -- Form Header State --
  const [serviceType, setServiceType] = useState<'BALCAO' | 'DELIVERY'>('DELIVERY');
  const [observations, setObservations] = useState('');
  const [dateTime, setDateTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [statusView, setStatusView] = useState('Pendente');
  const [employeeId, setEmployeeId] = useState('');
  const [depositId, setDepositId] = useState('');
  const activeDepositId = depositId || initialData?.depositoId || '';
  const paymentMethodConfigMap = useMemo(() => {
    const map = new Map<string, PaymentMethodDepositConfig>();
    if (!activeDepositId) return map;
    paymentMethodConfigs.forEach((config) => {
      if (config.deposit_id === activeDepositId) {
        map.set(config.payment_method_id, config);
      }
    });
    return map;
  }, [paymentMethodConfigs, activeDepositId]);
  const availablePaymentMethods = useMemo(() => {
    if (!activeDepositId) {
      return paymentMethodsDB.filter((method) => method.is_active !== false);
    }
    return paymentMethodsDB.filter((method) => {
      if (method.is_active === false) return false;
      const config = paymentMethodConfigMap.get(method.id);
      return config ? config.is_active !== false : true;
    });
  }, [paymentMethodsDB, paymentMethodConfigMap, activeDepositId]);
  const [zone, setZone] = useState('');
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [zoneTouched, setZoneTouched] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [zonePricingNotice, setZonePricingNotice] = useState<string | null>(null);
  const [deliveryFeeProductId, setDeliveryFeeProductId] = useState<string | null>(null);
  const [deliveryFeeManualOverride, setDeliveryFeeManualOverride] = useState(false);

  // -- State: Client --
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [clientSpecialPrices, setClientSpecialPrices] = useState<ClientSpecialPriceMap>({});
  
  // -- State: Cart --
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  
  // -- State: Sale Mode Modal (TROCA/COMPLETA) --
  const [showSaleModeModal, setShowSaleModeModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Produto | null>(null);
  
  // -- State: Payments --
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paymentValue, setPaymentValue] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<PaymentItem | null>(null);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<string>('');
  const [editingPaymentValue, setEditingPaymentValue] = useState<string>('');

  // Seleção automática de depósito/entregador quando há único disponível ou usuário amarrado a depósito
  useEffect(() => {
    if ((!depositId || depositId === '') && availableDeposits.length === 1) {
      setDepositId(availableDeposits[0].id);
    }
    if (serviceType === 'DELIVERY' && (!employeeId || employeeId === '') && availableDrivers.length === 1) {
      setEmployeeId(availableDrivers[0].id);
    }
  }, [availableDeposits, availableDrivers, depositId, employeeId, serviceType]);

  const pricingByZoneId = useMemo(() => {
    const map = new Map<string, any>();
    if (!depositId) return map;
    zonePricing.forEach((pricing: any) => {
      const normalized = normalizeDepositId(pricing);
      if (normalized.depositoId === depositId) {
        map.set(pricing.zone_id, pricing);
      }
    });
    return map;
  }, [zonePricing, depositId]);

  const zoneMatchFromInput = useMemo(
    () => findZoneMatch(zone, deliveryZones, deliverySectors),
    [zone, deliveryZones, deliverySectors]
  );
  const zoneMatchFromAddress = useMemo(
    () => findZoneMatch(deliveryAddress, deliveryZones, deliverySectors),
    [deliveryAddress, deliveryZones, deliverySectors]
  );

  const activeZoneForPreview = useMemo(() => {
    if (zoneId) return deliveryZonesById.get(zoneId) ?? null;
    return zoneMatchFromInput?.zone ?? zoneMatchFromAddress?.zone ?? null;
  }, [zoneId, deliveryZonesById, zoneMatchFromInput, zoneMatchFromAddress]);

  const activeZoneId = activeZoneForPreview?.id ?? null;
  const activeZoneName = activeZoneForPreview?.nome ?? '';

  const miniZonePolygons = useMemo(
    () =>
      deliveryZones
        .map((zone: any) => ({
          id: zone.id,
          nome: zone.nome ?? '',
          cor: zone.cor || '#f97316',
          polygon: normalizePolygon(zone.map_polygon),
        }))
        .filter((zone) => zone.polygon),
    [deliveryZones]
  );

  const activeZonePolygon = useMemo(() => {
    if (!activeZoneId) return null;
    const match = miniZonePolygons.find((zone) => zone.id === activeZoneId);
    return match?.polygon ?? null;
  }, [miniZonePolygons, activeZoneId]);

  const clientZoneId = selectedClient
    ? ((selectedClient as any).deliveryZoneId ?? (selectedClient as any).delivery_zone_id ?? null)
    : null;
  const clientZoneName = clientZoneId
    ? deliveryZonesById.get(clientZoneId)?.nome ?? ''
    : '';

  const addressMatchesProfile = useMemo(() => {
    if (!selectedClient) return null;
    const profileAddress = normalizeText(getClientAddress(selectedClient));
    const currentAddress = normalizeText(deliveryAddress || '');
    if (!profileAddress && !currentAddress) return null;
    return profileAddress === currentAddress;
  }, [selectedClient, deliveryAddress]);

  useEffect(() => {
    if (initialData) {
      setServiceType(initialData.tipoAtendimento);
      setObservations(initialData.observacoes || '');
      setDepositId(initialData.depositoId || '');
      setEmployeeId(initialData.entregadorId || '');
      setClientSearch('');
      setShowSuggestions(false);
      
      const cli = dbClients.find(c => c.id === initialData.clienteId);
      const resolvedClient =
        cli ??
        {
          id: initialData.clienteId,
          nome: initialData.clienteNome,
          endereco: initialData.enderecoEntrega || '',
          telefone: initialData.clienteTelefone,
          ativo: true,
          criado_em: 0,
          atualizado_em: 0,
        };
      setSelectedClient(resolvedClient as Cliente);
      setDeliveryAddress(initialData.enderecoEntrega || getClientAddress(resolvedClient) || '');
      setZoneTouched(false);
      const clientZoneId =
        (resolvedClient as any).deliveryZoneId ??
        (resolvedClient as any).delivery_zone_id ??
        null;
      if (clientZoneId) {
        const zoneData = deliveryZonesById.get(clientZoneId);
        const zoneName = zoneData?.nome ?? '';
        setZoneId(clientZoneId);
        if (zoneName) setZone(zoneName);
      } else {
        setZoneId(null);
        setZone('');
      }

      // Map Items
      const loadedItems: OrderItem[] = (initialData.itens ?? []).map(i => {
        const prod = products.find(p => p.id === i.produtoId);
        const isFeeItem =
          (deliveryFeeProductId && i.produtoId === deliveryFeeProductId) ||
          (prod && (prod.product_group ?? '') === DELIVERY_FEE_GROUP);
        return {
          id: i.id,
          produtoId: i.produtoId,
          nome: prod?.nome || (isFeeItem ? DELIVERY_FEE_NAME : 'Item removido'),
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          tipo: prod && isServiceProduct(prod) ? 'SERVICO' : prod?.tipo || 'OUTRO',
          sale_movement_type: (i as any).sale_movement_type ?? null, // Preservar modo de venda
          priceSource: 'AUTO',
          isManualPrice: false,
        };
      });
      setItems(loadedItems);

      // Map Payments
      const loadedPayments: PaymentItem[] = (initialData.pagamentos ?? []).map((p, idx) => {
        const method = paymentMethodsDB.find(m => m.id === (p as any).payment_method_id || (p as any).formaPagamentoId);
        return {
          id: `pay-${idx}`,
          methodId: (p as any).payment_method_id || (p as any).formaPagamentoId,
          methodName: method?.name ?? method?.nome ?? 'Pagamento',
          value: (p as any).amount ?? (p as any).valor,
          methodKind: normalizeMethodKind(method?.method_kind ?? null),
        };
      });
      setPayments(loadedPayments);
      const initialFeeRaw =
        (initialData as any).delivery_fee ??
        (initialData as any).deliveryFee ??
        (initialData as any).deliveryFeeValue ??
        0;
      setDeliveryFee(Number(initialFeeRaw) || 0);
      setDeliveryFeeManualOverride(false);
    }
  }, [initialData, dbClients, products, paymentMethodsDB, deliveryFeeProductId, deliveryZonesById]);

  // ✅ Force depositoId for local users (CAIXA, ATENDENTE, etc.)
  useEffect(() => {
    const isGlobalRole = (cargo?: string) => cargo === 'ENTREGADOR' || cargo === 'GERENTE';
    const isLocalUser = currentUser && !isGlobalRole(currentUser.cargo) && currentUser.depositoId;
    
    if (isLocalUser) {
      // Usuário local: força seu depositoId
      if (depositId !== currentUser.depositoId) {
        setDepositId(currentUser.depositoId);
      }
    }
  }, [currentUser?.depositoId, currentUser?.cargo, depositId]);

  useEffect(() => {
    if (zoneTouched) return;
    const match = zoneMatchFromAddress?.zone ?? null;
    if (!match) return;
    const nextName = match.nome ?? '';
    if (match.id !== zoneId) setZoneId(match.id);
    if (nextName && nextName !== zone) setZone(nextName);
  }, [zoneTouched, zoneMatchFromAddress, zoneId, zone]);

  const isPickupService = serviceType !== 'DELIVERY';

  useEffect(() => {
    if (isPickupService && employeeId) {
      setEmployeeId('');
    }
  }, [isPickupService, employeeId]);

  // -- Computed Totals --
  const isDeliveryFeeItem = (item: OrderItem) =>
    (Boolean(deliveryFeeProductId) && item.produtoId === deliveryFeeProductId) ||
    item.nome === DELIVERY_FEE_NAME;
  const itemsSubtotal = items.reduce(
    (acc, item) => (isDeliveryFeeItem(item) ? acc : acc + item.quantidade * item.precoUnitario),
    0
  );
  const appliedDeliveryFee = deliveryFeeManualOverride ? 0 : deliveryFee;
  const totalOrder = itemsSubtotal + appliedDeliveryFee;
  const totalPaid = payments.reduce((acc, p) => acc + p.value, 0);
  const remaining = Math.max(0, totalOrder - totalPaid);
  const selectedMethodEntity = paymentMethodsDB.find(m => m.id === selectedPaymentMethod);
  const isCashMethodSelected = selectedMethodEntity?.method_kind === 'CASH';
  const cashInputValue = isCashMethodSelected ? parseFloat(cashReceived || '0') : 0;
  const computedChange = cashInputValue > 0 ? Math.max(0, cashInputValue - totalOrder) : Math.max(0, totalPaid - totalOrder);
  const hasCashPayment = payments.some(p => p.methodKind === 'CASH') || isCashMethodSelected;
  const showChange = computedChange > 0 && hasCashPayment;

  useEffect(() => {
    if (serviceType !== 'DELIVERY') {
      if (deliveryFee !== 0) setDeliveryFee(0);
      if (zonePricingNotice) setZonePricingNotice(null);
      if (deliveryFeeManualOverride) setDeliveryFeeManualOverride(false);
      return;
    }

    if (deliveryFeeManualOverride) {
      if (deliveryFee !== 0) setDeliveryFee(0);
      if (zonePricingNotice) setZonePricingNotice(null);
      return;
    }

    const zoneKey = normalizeText(zone);
    if (!zoneKey && !zoneId && !zoneMatchFromAddress?.zone) {
      const fallbackRaw =
        (initialData as any)?.delivery_fee ??
        (initialData as any)?.deliveryFee ??
        (initialData as any)?.deliveryFeeValue ??
        0;
      const fallback = Number(fallbackRaw) || 0;
      if (deliveryFee !== fallback) setDeliveryFee(fallback);
      if (zonePricingNotice) setZonePricingNotice(null);
      return;
    }

    const matchedZone =
      (zoneId ? deliveryZonesById.get(zoneId) ?? null : null) ??
      zoneMatchFromInput?.zone ??
      zoneMatchFromAddress?.zone ??
      null;

    const currentDepositId = depositId || initialData?.depositoId || '';
    const currentDeposit = availableDeposits.find((d: any) => d.id === currentDepositId);
    const freeShippingMinRaw =
      (currentDeposit as any)?.free_shipping_min_value ??
      (currentDeposit as any)?.freeShippingMinValue ??
      (currentDeposit as any)?.freeShippingMin ??
      0;
    const freeShippingMin = Number(freeShippingMinRaw) || 0;

    const pricing = matchedZone && currentDepositId
      ? zonePricing.find((p: any) => {
          const normalized = normalizeDepositId(p);
          return p.zone_id === matchedZone.id && normalized.depositoId === currentDepositId;
        })
      : null;
    let nextFee = pricing ? Number(pricing.price ?? 0) : 0;
    if (matchedZone && currentDepositId && !pricing) {
      setZonePricingNotice('Este deposito nao possui preco para esta zona.');
    } else {
      setZonePricingNotice(null);
    }
    if (freeShippingMin > 0 && itemsSubtotal >= freeShippingMin) {
      nextFee = 0;
    }
    if (deliveryFee !== nextFee) setDeliveryFee(nextFee);
  }, [
    serviceType,
    zone,
    zoneId,
    deliveryFee,
    deliveryZonesById,
    itemsSubtotal,
    depositId,
    availableDeposits,
    zonePricing,
    initialData,
    zonePricingNotice,
    deliveryFeeManualOverride,
    zoneMatchFromInput,
    zoneMatchFromAddress,
  ]);

  useEffect(() => {
    if (!deliveryFeeProductId) return;

    setItems((prev) => {
      const existing = prev.find((item) => item.produtoId === deliveryFeeProductId);
      const shouldRemove =
        serviceType !== 'DELIVERY' ||
        deliveryFeeManualOverride;

      if (shouldRemove) {
        if (!existing) return prev;
        return prev.filter((item) => item.produtoId !== deliveryFeeProductId);
      }

      if (!existing) {
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            produtoId: deliveryFeeProductId,
            nome: DELIVERY_FEE_NAME,
            quantidade: 1,
            precoUnitario: appliedDeliveryFee,
            tipo: 'OUTROS',
            priceSource: 'AUTO',
            isManualPrice: false,
          },
        ];
      }

      if (existing.precoUnitario !== appliedDeliveryFee || existing.quantidade !== 1) {
        return prev.map((item) =>
          item.produtoId === deliveryFeeProductId
            ? { ...item, precoUnitario: appliedDeliveryFee, quantidade: 1 }
            : item
        );
      }

      return prev;
    });
  }, [deliveryFeeProductId, appliedDeliveryFee, deliveryFeeManualOverride, serviceType]);

  useEffect(() => {
    if (!deliveryFeeProductId) return;
    if (!deliveryFeeManualOverride) return;
    const hasFeeItem = items.some(
      (item) =>
        item.produtoId === deliveryFeeProductId || item.nome === DELIVERY_FEE_NAME
    );
    if (hasFeeItem) {
      setDeliveryFeeManualOverride(false);
    }
  }, [items, deliveryFeeProductId, deliveryFeeManualOverride]);

  // -- Handlers --
  const handleRemoveOrderItem = (item: OrderItem) => {
    if (
      (deliveryFeeProductId && item.produtoId === deliveryFeeProductId) ||
      item.nome === DELIVERY_FEE_NAME
    ) {
      setDeliveryFeeManualOverride(true);
      if (deliveryFee !== 0) setDeliveryFee(0);
    }
  };

  const handleSelectClient = (client: Cliente) => {
    setSelectedClient(client);
    setClientSearch('');
    setShowSuggestions(false);
    setDeliveryFeeManualOverride(false);
    setDeliveryAddress(getClientAddress(client) || '');
    setZoneTouched(false);
    const clientZoneId =
      (client as any).deliveryZoneId ??
      (client as any).delivery_zone_id ??
      null;
    if (clientZoneId) {
      const zoneData = deliveryZonesById.get(clientZoneId);
      const zoneName = zoneData?.nome ?? '';
      setZoneId(clientZoneId);
      if (zoneName) setZone(zoneName);
    } else {
      setZoneId(null);
      setZone('');
    }
    console.log('Client selected:', client);
  };

  useEffect(() => {
    let alive = true;
    if (!selectedClient) {
      setClientSpecialPrices({});
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const map = await loadClientSpecialPrices(selectedClient.id);
        if (!alive) return;
        setClientSpecialPrices(map);
      } catch (err) {
        console.error('Erro ao carregar precos especiais do cliente:', err);
        if (!alive) return;
        setClientSpecialPrices({});
        toast.error('Nao foi possivel carregar precos especiais do cliente.');
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedClient?.id]);

  const handleCustomerSearch = () => {
    setShowSuggestions(true);
  };

  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  useEffect(() => {
    const styleId = 'receipt-print-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
@media print {
  body * { visibility: hidden; }
  #receipt-print-area, #receipt-print-area * { visibility: visible; }
  #receipt-print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    background: white;
    color: black;
  }
}`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = async () => {
    const receipt = document.getElementById('receipt-print-area');
    if (!receipt) return;
    const canvas = await html2canvas(receipt, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`nota-${Date.now()}.pdf`);
  };

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatReceiptLine = (left: string, right: string, width = 40) => {
    const safeLeft = left.length > width ? left.slice(0, width) : left;
    const dots = Math.max(1, width - safeLeft.length - right.length);
    return `${safeLeft}${'.'.repeat(dots)}${right}`;
  };

  const generateReceiptPreview = () => {
    const now = new Date().toLocaleString('pt-BR');
    const clienteNome = selectedClient?.nome || 'Nao informado';
    const clienteEndereco = deliveryAddress.trim() || getClientAddress(selectedClient) || 'Nao informado';
    const clienteTelefone = selectedClient?.telefone || 'Nao informado';
    const subtotal = itemsSubtotal;
    const entrega = appliedDeliveryFee;
    const descontos = 0;
    const totalPagar = subtotal + entrega - descontos;

    const itemLines =
      items.length === 0
        ? ['(Sem itens)']
        : items.map((item) => {
            const totalItem = item.quantidade * item.precoUnitario;
            const modeLabel = item.sale_movement_type === 'EXCHANGE' 
              ? ' (TROCA)' 
              : item.sale_movement_type === 'FULL' 
                ? ' (COMPLETA)' 
                : '';
            const left = `${item.quantidade}x ${item.nome}${modeLabel}`;
            const right = `R$ ${formatMoney(totalItem)}`;
            return formatReceiptLine(left, right, 36);
          });

    const paymentLines =
      payments.length === 0
        ? ['Pagamento: Nao informado']
        : payments.map((p) => `- ${p.methodName}: R$ ${formatMoney(p.value)}`);

    const trocoLine = computedChange > 0 ? `Troco: R$ ${formatMoney(computedChange)}` : null;

    return [
      'GAS REAL',
      now,
      '--------------------------------',
      `Cliente: ${clienteNome}`,
      `Endereco: ${clienteEndereco}`,
      `Telefone: ${clienteTelefone}`,
      '--------------------------------',
      ...itemLines,
      '--------------------------------',
      `Subtotal: R$ ${formatMoney(subtotal)}`,
      `Entrega: R$ ${formatMoney(entrega)}`,
      `Descontos: R$ ${formatMoney(descontos)}`,
      `TOTAL A PAGAR: R$ ${formatMoney(totalPagar)}`,
      '--------------------------------',
      ...paymentLines,
      ...(trocoLine ? [trocoLine] : []),
      '--------------------------------',
      'Obrigado pela preferencia!',
    ].join('\n');
  };

  const handleSaveNewClient = (clientData: any) => {
    (async () => {
      const now = Date.now();
      const streetAddress = (
        clientData.streetAddress ??
        clientData.street_address ??
        clientData.endereco ??
        clientData.address ??
        ''
      ).trim();
      const neighborhood = (clientData.neighborhood ?? '').trim();
      const deliverySectorId = clientData.deliverySectorId ?? clientData.delivery_sector_id ?? null;
      const endereco = buildFullAddress(
        streetAddress,
        neighborhood,
        clientData.endereco ?? clientData.address ?? ''
      );
      const nome = clientData.nome ?? clientData.name ?? '';
      await upsertClient({
        nome,
        endereco,
        streetAddress,
        neighborhood,
        deliverySectorId,
        referencia: clientData.referencia ?? clientData.reference ?? '',
        cpf: clientData.cpf,
        telefone: clientData.telefone ?? clientData.phone ?? '',
        dataNascimento: clientData.dataNascimento,
        deliveryZoneId: clientData.deliveryZoneId ?? clientData.delivery_zone_id ?? null,
        ativo: true,
        criado_em: now,
        atualizado_em: now,
      } as any);
      const refreshed = await listClients();
      setDbClients(refreshed);
      const selected = refreshed.find(
        c => c.nome === nome && (c.cpf === clientData.cpf || !clientData.cpf)
      );
      if (selected) handleSelectClient(selected);
    })();
  };

  /**
   * Verifica se o produto requer escolha de modo de venda (TROCA ou COMPLETA).
   * Produtos com movement_type='EXCHANGE' permitem escolha no momento da venda.
   */
  const requiresSaleModeChoice = (prod: Produto): boolean => {
    const mt = String(prod.movement_type ?? '').toUpperCase();
    return mt === 'EXCHANGE';
  };

  /**
   * Adiciona item real ao carrinho após escolha do modo de venda.
   * Usa o preço correto baseado na modalidade:
   * - EXCHANGE (TROCA): usa preco_troca se definido
   * - FULL (COMPLETA): usa preco_completa se definido
   * - Fallback: preco_padrao
   */
  const addItemToCart = (prod: Produto, saleMode: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null) => {
    const existingItem = items.find(i => i.produtoId === prod.id && i.sale_movement_type === saleMode);
    if (existingItem) {
      handleUpdateQuantity(existingItem.id, existingItem.quantidade + 1);
      return;
    }
    
    // Determinar preço baseado na modalidade de venda
    let precoFinal = prod.preco_padrao;
    if (saleMode === 'EXCHANGE') {
      // TROCA: cliente devolve casco → usa preco_troca
      precoFinal = (prod as any).preco_troca ?? prod.preco_padrao;
    } else if (saleMode === 'FULL') {
      // COMPLETA: cliente leva casco → usa preco_completa  
      precoFinal = (prod as any).preco_completa ?? prod.preco_padrao;
    }
    
    const newItem: OrderItem = {
      id: crypto.randomUUID(),
      produtoId: prod.id,
      nome: prod.nome,
      quantidade: 1,
      precoUnitario: precoFinal,
      tipo: prod.tipo,
      sale_movement_type: saleMode,
      priceSource: 'AUTO',
      isManualPrice: false,
    };
    setItems([...items, newItem]);
  };

  /**
   * Handler chamado ao selecionar um produto.
   * Se for produto EXCHANGE, abre modal de escolha TROCA/COMPLETA.
   */
  const handleAddItem = (prod: Produto) => {
    // Se produto requer escolha de modo, abre modal
    if (requiresSaleModeChoice(prod)) {
      setPendingProduct(prod);
      setShowSaleModeModal(true);
      return;
    }
    
    // Produto simples: adiciona direto
    addItemToCart(prod, null);
  };

  /**
   * Handler do modal de modo de venda - confirma escolha.
   */
  const handleSaleModeConfirm = (mode: 'EXCHANGE' | 'FULL') => {
    if (!pendingProduct) return;
    addItemToCart(pendingProduct, mode);
    setPendingProduct(null);
    setShowSaleModeModal(false);
  };

  /**
   * Handler do modal de modo de venda - cancela.
   */
  const handleSaleModeCancel = () => {
    setPendingProduct(null);
    setShowSaleModeModal(false);
  };

  const handleUpdateQuantity = (itemId: string, newQty: number | string) => {
    const qty = typeof newQty === 'string' ? parseInt(newQty) : newQty;
    if (typeof qty === 'number' && !isNaN(qty) && qty > 0) {
      setItems(items.map(i => i.id === itemId ? { ...i, quantidade: qty } : i));
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) handleRemoveOrderItem(item);
    setItems(items.filter(i => i.id !== itemId));
  };

  const handleAddPayment = () => {
    if (!selectedPaymentMethod) return;

    const method = paymentMethodsDB.find(m => m.id === selectedPaymentMethod);
    if (!method) return;

    const isCash = method.method_kind === 'CASH';
    const baseValue = isCash ? (cashReceived ? parseFloat(cashReceived) : 0) : (paymentValue ? parseFloat(paymentValue) : remaining);
    const valToUse = baseValue > 0 ? baseValue : remaining;
    if (valToUse <= 0) return;

    const newPayment: PaymentItem = {
      id: crypto.randomUUID(),
      methodId: method.id,
      methodName: method.name,
      methodKind: method.method_kind,
      value: valToUse,
    };

    setPayments([...payments, newPayment]);
    setPaymentValue('');
    setCashReceived('');
    if (valToUse >= remaining) setSelectedPaymentMethod('');
    
    // Registrar no histórico se estiver editando OS existente
    if (initialData?.id) {
      addHistoryLog(
        'PAGAMENTO_ADICIONADO',
        `Adicionado ${method.name}: R$ ${valToUse.toFixed(2)}`
      );
    }
  };

  const handleEditPayment = (payment: PaymentItem) => {
    setSelectedPaymentForEdit(payment);
    setEditingPaymentMethod(payment.methodId);
    setEditingPaymentValue(payment.value.toFixed(2));
  };

  const handleUpdatePayment = () => {
    if (!selectedPaymentForEdit || !editingPaymentMethod) return;
    
    const newValue = parseFloat(editingPaymentValue);
    if (isNaN(newValue) || newValue <= 0) return;
    
    const method = paymentMethodsDB.find(m => m.id === editingPaymentMethod);
    if (!method) return;
    
    const oldPayment = selectedPaymentForEdit;
    const updatedPayment: PaymentItem = {
      ...oldPayment,
      methodId: method.id,
      methodName: method.name,
      methodKind: method.method_kind,
      value: newValue,
    };
    
    setPayments(payments.map(p => p.id === oldPayment.id ? updatedPayment : p));
    
    // Registrar no histórico se estiver editando OS existente
    if (initialData?.id) {
      const changes: string[] = [];
      if (oldPayment.methodName !== method.name) {
        changes.push(`Forma: ${oldPayment.methodName} → ${method.name}`);
      }
      if (oldPayment.value !== newValue) {
        changes.push(`Valor: R$ ${oldPayment.value.toFixed(2)} → R$ ${newValue.toFixed(2)}`);
      }
      if (changes.length > 0) {
        addHistoryLog('PAGAMENTO_EDITADO', changes.join(', '));
      }
    }
    
    // Limpar edição
    setSelectedPaymentForEdit(null);
    setEditingPaymentMethod('');
    setEditingPaymentValue('');
  };

  const handleCancelEditPayment = () => {
    setSelectedPaymentForEdit(null);
    setEditingPaymentMethod('');
    setEditingPaymentValue('');
  };

  const handleRemovePayment = (payment: PaymentItem) => {
    setPayments(payments.filter(p => p.id !== payment.id));
    
    // Registrar no histórico se estiver editando OS existente
    if (initialData?.id) {
      addHistoryLog(
        'PAGAMENTO_REMOVIDO',
        `Removido ${payment.methodName}: R$ ${payment.value.toFixed(2)}`
      );
    }
  };
  
  // Helper para adicionar log no histórico
  const addHistoryLog = async (acao: string, detalhe: string) => {
    if (!initialData?.id) return; // Só loga em OS existentes
    
    const newLog: LogHistoricoOS = {
      id: crypto.randomUUID(),
      data: Date.now(), // Timestamp em milissegundos
      usuario: currentUser?.nome || 'Sistema',
      usuarioId: currentUser?.id || SYSTEM_USER_ID,
      acao,
      detalhe,
    };
    
    // Atualizar histórico na OS
    const osAtual = await db.service_orders.get(initialData.id);
    if (osAtual) {
      const historico = [...(osAtual.historico || [])];
      historico.unshift(newLog);
      await db.service_orders.update(initialData.id, { historico });
    }
  };

  useEffect(() => {
    if (selectedPaymentMethod && remaining > 0 && !paymentValue) {
      setPaymentValue(remaining.toFixed(2));
    }
  }, [selectedPaymentMethod, remaining, paymentValue]);

  const filteredSuggestions = useMemo(() => {
    if (!showSuggestions) return [];
    const query = clientSearch.trim().toLowerCase();
    return dbClients.filter(c => {
      if (!query) return true;
      const nome = (c.nome ?? '').toLowerCase();
      const endereco = (c.endereco ?? '').toLowerCase();
      return (
        nome.includes(query) ||
        c.telefone?.includes(query) ||
        endereco.includes(query)
      );
    });
  }, [clientSearch, dbClients, showSuggestions]);

  // -- SAVE / UPDATE --
  const handleFinalize = async () => {
    if (!selectedClient || items.length === 0) return;
    if (!depositId && !initialData?.depositoId) {
      alert('Selecione um deposito para a O.S.');
      return;
    }
    if (serviceType === 'DELIVERY' && !employeeId) {
      alert('Selecione um entregador para entrega.');
      return;
    }

    try {
    const orderItems: ItemOrdemServico[] = items.map(i => {
      const isFeeItem =
        (deliveryFeeProductId && i.produtoId === deliveryFeeProductId) ||
        i.nome === DELIVERY_FEE_NAME;
      return {
        id: i.id,
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        modalidade: isFeeItem ? 'SERVICO' : 'VENDA',
        sale_movement_type: i.sale_movement_type ?? null, // Modo de venda escolhido
      };
    });

    const orderPayments = payments.map((p) => ({
      payment_method_id: p.methodId,
      amount: p.value,
    }));

    // Determinar Status Inicial
    let finalStatus: StatusOS = 'PENDENTE';
    // Se for DELIVERY, vai para o fluxo de despacho
    if (serviceType === 'DELIVERY') {
      finalStatus = 'PENDENTE_ENTREGA';
    }

    const effectiveDepositId = depositId || initialData?.depositoId || 'DEP1';

    const orderData: OrdemServico = {
      id: initialData?.id || crypto.randomUUID(),
      numeroOs: initialData?.numeroOs || Date.now().toString().slice(-6),
      depositoId: effectiveDepositId,
      clienteId: selectedClient.id,
      clienteNome: selectedClient.nome,
      clienteTelefone: selectedClient.telefone,
      enderecoEntrega: deliveryAddress.trim() || getClientAddress(selectedClient),
      // Em app real pegaria geocode aqui
      status: finalStatus,
      tipoAtendimento: serviceType,
      entregadorId: employeeId || null,
      observacoes: observations,
      itens: orderItems,
      pagamentos: orderPayments as any,
      total: totalOrder,
      delivery_fee: appliedDeliveryFee,
      dataHoraCriacao: initialData?.dataHoraCriacao || Date.now(),
      updated_at: Date.now(),
      historico: initialData?.historico || []
    };

    // Log
    const logEntry: LogHistoricoOS = {
      data: Date.now(),
      usuario: getSessionUserName() || 'Operador',
      acao: initialData ? 'Edição Manual' : 'Criação',
      detalhe: initialData ? 'Alterou dados da O.S.' : `Nova O.S. tipo ${serviceType}`
    };

    const createdAtIso = new Date(orderData.dataHoraCriacao || Date.now()).toISOString();
    const updatedAtIso = new Date().toISOString();
    const orderPayload: ServiceOrderInsert = {
      id: orderData.id,
      order_number: orderData.numeroOs,
      deposit_id: effectiveDepositId,
      client_id: selectedClient.id,
      client_name: selectedClient.nome ?? null,
      client_phone: selectedClient.telefone ?? null,
      delivery_address: orderData.enderecoEntrega ?? null,
      service_type: serviceType,
      status: finalStatus,
      subtotal: itemsSubtotal,
      total: totalOrder,
      delivery_fee: appliedDeliveryFee,
      driver_id: employeeId || null,
      delivery_zone_id: zoneId || null,
      delivery_sector_id: selectedClient.deliverySectorId ?? null,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
    };

    const itemsPayload: NewServiceOrderItem[] = orderItems.map((item) => ({
      order_id: orderData.id,
      product_id: item.produtoId,
      quantity: item.quantidade,
      unit_price: item.precoUnitario,
      modality: item.modalidade ?? 'VENDA',
      sale_movement_type: item.sale_movement_type ?? null,
    }));

    const paymentsPayload: NewServiceOrderPayment[] = payments.map((payment) => ({
      order_id: orderData.id,
      payment_method_id: payment.methodId ?? null,
      payment_method_name: payment.methodName ?? null,
      amount: payment.value,
    }));

    // 1. Save OS
    const historico = [...(orderData.historico || [])];
    historico.unshift(logEntry);
    await upsertServiceOrder(orderPayload, itemsPayload, paymentsPayload);

    if (!initialData?.id) {
      const receivableCandidates = payments.filter((payment) => payment.value > 0);
      for (const payment of receivableCandidates) {
        const method = paymentMethodsDB.find((m) => m.id === payment.methodId);
        if (!method) continue;
        const isImmediate = method.receipt_type === 'IMMEDIATE';
        if (isImmediate || !method.generates_receivable) continue;

        const config = paymentMethodConfigMap.get(method.id);
        const configActive = config?.is_active ?? true;
        const dueDays = Number(config?.due_days ?? 0);
        if (!configActive || dueDays <= 0) continue;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        await financialService.createReceivable({
          order_id: orderData.id,
          deposit_id: effectiveDepositId,
          client_id: selectedClient.id,
          client_name: selectedClient.nome,
          original_amount: payment.value,
          paid_amount: 0,
          remaining_amount: payment.value,
          status: 'PENDENTE',
          due_date: dueDate.toISOString().split('T')[0],
          notes: `OS ${orderData.numeroOs} - ${method.name ?? method.id}`,
        });
      }
    }

    if (serviceType === 'BALCAO') {
      await serviceOrderService.complete(orderData.id);
    }

    // 2. Create Delivery Job if needed
    if (serviceType === 'DELIVERY' && !initialData) {
      await createDeliveryJobFromOS(orderData);
    }

    onSuccess();
    } catch (error) {
      console.error('Erro ao salvar O.S.:', error);
      toast.error('Nao foi possivel salvar a O.S.');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-transparent text-gray-900">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="space-y-4 min-w-0">
          <div className="space-y-2">
            <span className="inline-block text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">Dados Gerais</span>
            <div className="border border-gray-300 rounded bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Data/Hora:</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="h-8 px-2 rounded border border-gray-300 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Status:</label>
                <select
                  value={statusView}
                  onChange={(e) => setStatusView(e.target.value)}
                  className="h-8 px-2 rounded border border-gray-300 bg-white"
                >
                  <option>Pendente</option>
                  <option>Em Andamento</option>
                  <option>Concluída</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Tipo de atendimento:</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as 'BALCAO' | 'DELIVERY')}
                  className="h-8 px-2 rounded border border-gray-300 bg-white"
                >
                  <option value="DELIVERY">Delivery</option>
                  <option value="BALCAO">Balcão</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Entregador:</label>
                <select
                  value={employeeId || ''}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={isPickupService}
                  className="w-full h-9 px-2 border border-gray-300 rounded focus:border-blue-500 outline-none text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">{isPickupService ? 'Nao se aplica (Balcao)' : 'Selecione o Entregador...'}</option>
                  {availableDrivers.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.nome || d.username}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Depósito:</label>
                {(() => {
                  const isGlobalRole = (cargo?: string) => cargo === 'ENTREGADOR' || cargo === 'GERENTE';
                  const isLocalUser = currentUser && !isGlobalRole(currentUser.cargo) && currentUser.depositoId;
                  
                  if (isLocalUser) {
                    // ✅ Usuário local: apenas exibe seu depósito (não pode mudar)
                    return (
                      <div className="px-2 py-2 rounded border border-gray-300 bg-gray-100 text-gray-700 font-semibold text-sm">
                        📍 {availableDeposits.find((d: any) => d.id === depositId)?.nome || 'Carregando...'}
                      </div>
                    );
                  }
                  
                  // ✅ ADM/GERENTE: pode selecionar qualquer depósito
                  return (
                    <select
                      value={depositId || ''}
                      onChange={(e) => setDepositId(e.target.value)}
                      className="w-full h-9 px-2 border border-gray-300 rounded focus:border-blue-500 outline-none text-sm bg-white"
                    >
                      <option value="">Selecione o Depósito...</option>
                      {availableDeposits.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Bairro/Zona:</label>
                <input
                  type="text"
                  value={zone}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setZone(nextValue);
                    setZoneTouched(true);
                    const match = findZoneMatch(nextValue, deliveryZones, deliverySectors);
                    setZoneId(match?.zone?.id ?? null);
                    if (deliveryFeeManualOverride) setDeliveryFeeManualOverride(false);
                  }}
                  className="h-8 px-2 rounded border border-gray-300 bg-white"
                />
                {zonePricingNotice && (
                  <div className="text-[10px] text-amber-600">{zonePricingNotice}</div>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Endereco para entrega:</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    setZoneTouched(false);
                  }}
                  placeholder="Rua, numero, bairro"
                  className="h-8 px-2 rounded border border-gray-300 bg-white"
                />
                {addressMatchesProfile === true && (
                  <div className="text-[10px] text-emerald-600">Endereco igual ao cadastro do cliente.</div>
                )}
                {addressMatchesProfile === false && (
                  <div className="text-[10px] text-amber-600">Endereco da entrega diferente do cadastro do cliente.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="inline-block text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">Cliente</span>
          <div className="border border-gray-300 rounded bg-white p-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-end">
              <div className="flex flex-col gap-1 lg:col-span-3">
                <label className="font-semibold text-gray-700">Cliente selecionado:</label>
                <input
                  type="text"
                  value={selectedClient?.nome || ''}
                  readOnly
                  placeholder="Nenhum cliente selecionado"
                  className="h-8 px-2 rounded border border-gray-300 bg-white text-gray-700"
                />
              </div>
              <div className="flex flex-col gap-1 lg:col-span-3">
                <label className="font-semibold text-gray-700">Buscar cliente:</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setShowSuggestions(true); }}
                      placeholder="Digite para buscar"
                      className="h-8 px-2 rounded border border-gray-300 bg-white w-full"
                    />
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                        {filteredSuggestions.length === 0 ? (
                          <div className="px-2 py-2 text-xs text-gray-500">Nenhum cliente encontrado.</div>
                        ) : (
                          filteredSuggestions.map(c => (
                            <button key={c.id} onClick={() => handleSelectClient(c)} className="w-full text-left px-2 py-1.5 hover:bg-gray-50">
                              <div className="font-semibold">{c.nome}</div>
                              <div className="text-xs text-gray-500">{c.endereco}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCustomerSearch}
                    className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:text-blue-700 hover:border-blue-400"
                    title="Buscar cliente"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowClientModal(true)}
                    className="h-8 px-3 rounded border border-gray-300 text-blue-700 font-semibold hover:border-blue-400"
                  >
                    + Novo
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Telefone:</label>
                <input
                  type="text"
                  value={selectedClient?.telefone || ''}
                  readOnly
                  placeholder="(00) 00000-0000"
                  className="h-8 px-2 rounded border border-gray-300 bg-white text-gray-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Endereço:</label>
                <input
                  type="text"
                  value={getClientAddress(selectedClient) || ''}
                  readOnly
                  placeholder="Endereço completo"
                  className="h-8 px-2 rounded border border-gray-300 bg-white text-gray-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">CPF:</label>
                <input
                  type="text"
                  value={selectedClient?.cpf || ''}
                  readOnly
                  placeholder="CPF (opcional)"
                  className="h-8 px-2 rounded border border-gray-300 bg-white text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="inline-block text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">Itens da Ordem</span>
          <div className="border border-gray-300 rounded bg-white p-4 space-y-3">
            <ServiceOrderItems
              selectedDepositId={depositId || null}
              items={items}
              setItems={setItems}
              clientSpecialPrices={clientSpecialPrices}
              includeProductIds={deliveryFeeProductId ? [deliveryFeeProductId] : []}
              lockedProductIds={deliveryFeeProductId ? [deliveryFeeProductId] : []}
              onRemoveItem={handleRemoveOrderItem}
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="inline-block text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">Pagamentos</span>
          <div className="border border-gray-300 rounded bg-white p-4 space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 border border-gray-200">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-left">Forma</th>
                    <th className="px-2 py-2 text-left">Valor</th>
                    <th className="px-2 py-2 text-left">Parcelas</th>
                    <th className="px-2 py-2 text-left">1º Venc.</th>
                    <th className="px-2 py-2 text-left">Máquina</th>
                    <th className="px-2 py-2 text-left">Observação</th>
                    <th className="px-2 py-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                        Nenhum pagamento adicionado.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-200">
                        <td className="px-2 py-2">{p.methodName}</td>
                        <td className="px-2 py-2">R$ {p.value.toFixed(2)}</td>
                        <td className="px-2 py-2">1</td>
                        <td className="px-2 py-2">-</td>
                        <td className="px-2 py-2">-</td>
                        <td className="px-2 py-2">-</td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditPayment(p)}
                              className="text-orange-600 hover:text-orange-800 p-1"
                              title="Editar pagamento"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemovePayment(p)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Remover pagamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Modal de Edição de Pagamento */}
            {selectedPaymentForEdit && (
              <div className="border border-orange-400 rounded bg-orange-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-orange-800">Editando Pagamento</span>
                  <button onClick={handleCancelEditPayment} className="text-gray-500 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <select
                    value={editingPaymentMethod}
                    onChange={e => setEditingPaymentMethod(e.target.value)}
                    className="h-8 px-2 border border-gray-300 rounded text-gray-700 bg-white"
                  >
                    <option value="">Forma</option>
                    {availablePaymentMethods.map(m => (
                      <option key={m.id} value={m.id}>{m.name ?? m.nome}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={editingPaymentValue}
                    onChange={(e) => setEditingPaymentValue(e.target.value)}
                    placeholder="Valor"
                    className="h-8 w-28 px-2 border border-gray-300 rounded text-gray-700 bg-white"
                  />
                  <button 
                    onClick={handleUpdatePayment}
                    className="flex items-center gap-1 text-green-600 hover:text-green-800 font-semibold"
                  >
                    <Save className="w-4 h-4" /> Salvar
                  </button>
                  <button 
                    onClick={handleCancelEditPayment}
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            
            {/* Formulário de Adição de Pagamento */}
            {!selectedPaymentForEdit && (
              <div className="flex flex-wrap gap-3 items-center text-sm text-blue-700 font-semibold">
                <select
                  value={selectedPaymentMethod}
                  onChange={e => setSelectedPaymentMethod(e.target.value)}
                  className="h-8 px-2 border border-gray-300 rounded text-gray-700 bg-white"
                >
                  <option value="">Forma</option>
                  {availablePaymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.name ?? m.nome}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={paymentValue}
                  onChange={(e) => setPaymentValue(e.target.value)}
                  placeholder="Valor"
                  className="h-8 w-28 px-2 border border-gray-300 rounded text-gray-700 bg-white"
                />
                <button onClick={handleAddPayment} className="flex items-center gap-1">+ Adicionar Pagamento</button>
              </div>
            )}
            
            {selectedMethodEntity?.method_kind === 'CASH' && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <label className="font-semibold">Valor Recebido (Dinheiro):</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="h-8 w-32 px-2 border border-gray-300 rounded"
                />
                {computedChange > 0 && (
                  <span className="text-green-600 font-semibold">Troco: R$ {computedChange.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <span className="inline-block text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">Resumo Financeiro</span>
          <div className="border border-gray-300 rounded bg-white p-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 lg:col-span-1">
                <label className="font-semibold text-gray-700">Subtotal:</label>
                <input className="h-8 px-2 border border-gray-300 rounded bg-white" value={`R$ ${itemsSubtotal.toFixed(2)}`} readOnly />
              </div>
              <div className="flex flex-col gap-1 lg:col-span-1">
                <label className="font-semibold text-gray-700">Taxa de entrega:</label>
                <input className="h-8 px-2 border border-gray-300 rounded bg-white" value={`R$ ${appliedDeliveryFee.toFixed(2)}`} readOnly />
                {deliveryFeeManualOverride && (
                  <div className="text-[10px] text-amber-600">Taxa removida manualmente.</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 lg:col-span-1">
                <label className="font-semibold text-gray-700">Valor Total:</label>
                <input className="h-8 px-2 border border-gray-300 rounded bg-white" value={`R$ ${totalOrder.toFixed(2)}`} readOnly />
              </div>
              <div className="flex flex-col gap-1 lg:col-span-1">
                <label className="font-semibold text-gray-700">Total Pago:</label>
                <input className="h-8 px-2 border border-gray-300 rounded bg-white" value={`R$ ${totalPaid.toFixed(2)}`} readOnly />
              </div>
              <div className="flex flex-col gap-1 lg:col-span-1">
                <label className="font-semibold text-green-700">Restante:</label>
                <input className="h-8 px-2 border border-gray-300 rounded bg-white text-green-700 font-semibold" value={`R$ ${remaining.toFixed(2)}`} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Observações:</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="min-h-[90px] px-2 py-2 border border-gray-300 rounded"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-700">Resumo Nota:</label>
                <div
                  id="receipt-print-area"
                  className="bg-yellow-50 border border-gray-300 p-4 h-full overflow-y-auto font-mono text-xs text-black shadow-inner leading-tight"
                >
                  <pre className="whitespace-pre-wrap">{generateReceiptPreview()}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 min-w-0 self-start">
        <div className="space-y-2">
          <span className="inline-block text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">Zonas e mapa</span>
          <div className="border border-gray-300 rounded bg-white p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-600 uppercase">Orientacao de zona</span>
              <span className="text-[11px] text-gray-500">
                Deposito: {availableDeposits.find((d: any) => d.id === (depositId || initialData?.depositoId))?.nome || 'Nao selecionado'}
              </span>
            </div>
            {clientZoneId && activeZoneId && clientZoneId !== activeZoneId && (
              <div className="text-[11px] text-amber-600">
                Zona do cadastro: {clientZoneName || 'Nao definida'} / Zona detectada: {activeZoneName || 'Nao definida'}
              </div>
            )}
            {!activeZoneId && zone && (
              <div className="text-[11px] text-amber-600">Zona nao encontrada para "{zone}".</div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <div className="relative z-0 h-48 rounded border border-gray-200 overflow-hidden">
                <MapContainer
                  center={[HUB_COORDS.lat, HUB_COORDS.lng]}
                  zoom={12}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution="&copy; OSM contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MiniMapResizeHandler />
                  <MiniMapFit
                    polygons={miniZonePolygons.map((zone) => zone.polygon as LatLngTuple[][])}
                    activePolygon={activeZonePolygon}
                  />
                  {miniZonePolygons.map((zone) => {
                    const isActive = zone.id === activeZoneId;
                    return (
                      <Polygon
                        key={zone.id}
                        positions={zone.polygon as LatLngTuple[][]}
                        pathOptions={{
                          color: isActive ? zone.cor : '#94a3b8',
                          fillColor: zone.cor,
                          fillOpacity: isActive ? 0.35 : 0.12,
                          weight: isActive ? 2 : 1,
                        }}
                      >
                        <Tooltip sticky>{zone.nome}</Tooltip>
                      </Polygon>
                    );
                  })}
                </MapContainer>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {deliveryZones.length === 0 ? (
                  <div className="text-xs text-gray-500">Nenhuma zona cadastrada.</div>
                ) : (
                  deliveryZones.map((zone) => {
                    const zonePrice = pricingByZoneId.get(zone.id);
                    const priceLabel = !depositId
                      ? 'Selecione deposito'
                      : zonePrice
                        ? `R$ ${Number(zonePrice.price || 0).toFixed(2)}`
                        : 'Sem preco';
                    const isActive = zone.id === activeZoneId;
                    return (
                      <div
                        key={zone.id}
                        className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${
                          isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: zone.cor || '#f97316' }}
                          />
                          <span className="text-xs font-semibold text-gray-800">{zone.nome}</span>
                        </div>
                        <span className={`text-[11px] font-bold ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>
                          {priceLabel}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <div className="flex flex-col gap-3 mt-6 text-sm lg:flex-row lg:items-center">
        {remaining > 0 && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">Pagamento pendente: R$ {formatMoney(remaining)}</span>
          </div>
        )}
        <div className="flex justify-end gap-3 lg:ml-auto">
          <button onClick={handleSavePdf} className="px-4 py-2 rounded border border-gray-300 text-purple-700 font-semibold">Salvar Nota</button>
          <button onClick={handlePrint} className="px-4 py-2 rounded border border-gray-300 text-purple-700 font-semibold">Imprimir Nota</button>
          <button onClick={() => setShowReceiptPreview(true)} className="px-4 py-2 rounded border border-gray-300 text-purple-700 font-semibold">Pre-visualizar Nota</button>
          <button onClick={onCancel} className="px-4 py-2 rounded border border-gray-300 text-gray-700 font-semibold">Cancelar</button>
          <button
            onClick={handleFinalize}
            disabled={items.length === 0 || !selectedClient}
            className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Salvar O.S
          </button>
        </div>
      </div>
      
      {/* Modal de Modo de Venda (TROCA/COMPLETA) */}
      {showSaleModeModal && pendingProduct && (() => {
        // Calcular preços para exibição
        const precoTroca = (pendingProduct as any).preco_troca ?? pendingProduct.preco_padrao;
        const precoCompleta = (pendingProduct as any).preco_completa ?? pendingProduct.preco_padrao;
        
        return (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-600 text-white px-4 py-3 flex items-center gap-2">
              <span className="text-xl">🔄</span>
              <span className="font-bold">Tipo de Venda</span>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-2">
                Você está vendendo: <strong>{pendingProduct.nome}</strong>
              </p>
              <p className="text-gray-600 text-sm mb-6">
                Como será a venda deste produto?
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleSaleModeConfirm('EXCHANGE')}
                  className="w-full p-4 rounded-lg border-2 border-green-500 bg-green-50 hover:bg-green-100 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔁</span>
                      <div>
                        <div className="font-bold text-green-800">TROCA</div>
                        <div className="text-sm text-green-700">Cliente devolve casco vazio</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-green-700">R$ {precoTroca.toFixed(2)}</div>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleSaleModeConfirm('FULL')}
                  className="w-full p-4 rounded-lg border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📦</span>
                      <div>
                        <div className="font-bold text-blue-800">COMPLETA</div>
                        <div className="text-sm text-blue-700">Cliente leva o casco (cliente novo)</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-blue-700">R$ {precoCompleta.toFixed(2)}</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 flex justify-end">
              <button
                onClick={handleSaleModeCancel}
                className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
        );
      })()}
      
      {showClientModal && <NewClientModal onClose={() => setShowClientModal(false)} onSave={handleSaveNewClient} />}
      {showReceiptPreview && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl h-[90vh] rounded shadow-2xl border border-gray-300 flex flex-col overflow-hidden">
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between text-white">
              <span className="text-sm font-bold uppercase tracking-wide">Pre-visualizacao da Nota</span>
              <button onClick={() => setShowReceiptPreview(false)} className="p-1.5 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
              <div className="bg-yellow-50 border border-gray-300 p-4 h-full font-mono text-xs text-black shadow-inner leading-tight">
                <pre className="whitespace-pre-wrap">{generateReceiptPreview()}</pre>
              </div>
            </div>
            <div className="bg-white border-t border-gray-300 px-4 py-3 flex justify-end gap-2">
              <button onClick={() => setShowReceiptPreview(false)} className="px-4 py-2 rounded border border-gray-300 text-gray-700 font-semibold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};

interface NewServiceOrderProps {
  onClose: () => void;
  currentUser?: Colaborador;
}

export const NewServiceOrder: React.FC<NewServiceOrderProps> = ({ onClose, currentUser }) => {
  // ... (Same container logic) ...
  const [view, setView] = useState<'list' | 'create'>('list');
  const [activeTab, setActiveTab] = useState<StatusOS | 'TODOS'>('PENDENTE');
  const [orders, setOrders] = useState<OrdemServico[]>([]);
  const [products, setProducts] = useState<Produto[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [employees, setEmployees] = useState<Colaborador[]>([]);
  const [availableDeposits, setAvailableDeposits] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Colaborador[]>([]);
  const [editingOrder, setEditingOrder] = useState<OrdemServico | null>(null);
  const [timelineOrder, setTimelineOrder] = useState<OrdemServico | null>(null);
  const handleCancel = () => {
    setView('list');
    setEditingOrder(null);
    setTimelineOrder(null);
  };

  const fmtCurrency = (val: number) =>
    Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const resolveEmployeeName = (id?: string | null) => {
    if (!id) return null;
    const emp = employees.find((e) => e.id === id);
    return emp?.nome || (emp as any)?.username || id;
  };

  const handleSuccess = async () => {
    // Recarrega lista após salvar/editar e volta para listagem
    setOrders(await listServiceOrders());
    setView('list');
    setEditingOrder(null);
    setTimelineOrder(null);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      let ords: OrdemServico[] = [];
      let prodsRaw: Produto[] = [];
      let methods: PaymentMethod[] = [];
      let empsRaw: EmployeeRow[] = [];
      let depsRaw: DepositRow[] = [];
      try {
        [ords, prodsRaw, methods, empsRaw, depsRaw] = await Promise.all([
          listServiceOrders(),
          productService.getAll(),
          listPaymentMethods(),
          employeeService.getAll(),
          depositService.getAll(),
        ]);
      } catch (err) {
        console.error('Erro ao carregar dados iniciais (produtos/depósitos/funcionários)', err);
        toast.error('Erro ao carregar depósitos');
        // Fallbacks
        ords = await listServiceOrders().catch(() => []);
        prodsRaw = [];
        methods = await listPaymentMethods().catch(() => []);
        empsRaw = [];
        depsRaw = [];
      }
      if (!alive) return;

      // Map products (service row -> Produto)
      const prods = (prodsRaw || []).map(mapProductRowToProduto);

      // Map employees (service row -> Colaborador)
      const emps = (empsRaw || []).map((e: any) => ({
        id: e.id,
        nome: e.name,
        cargo: e.role,
        depositoId: e.deposit_id,
        ativo: e.active,
        username: e.username,
        permissoes: e.permissions || [],
      } as Colaborador));

      // Filter deposits: if user tem depositoId, restringe
      const deps = (depsRaw || []).map((d: any) => ({
        id: d.id,
        nome: d.name,
        ativo: d.active,
        endereco: d.address,
        cor: d.color,
      })).filter((d: any) => currentUser?.depositoId ? d.id === currentUser.depositoId : (d.ativo !== false));

      // Drivers: entregador ou motorista (role ENTREGADOR ou nome contém ENTREG)
      const drivers = emps.filter((e) => {
        const cargo = String(e.cargo ?? '').toUpperCase();
        const isDriver = cargo.includes('ENTREG') || cargo.includes('MOTOR');
        if (!isDriver) return false;
        if (currentUser?.depositoId) {
          return e.depositoId === currentUser.depositoId || e.depositoId === null;
        }
        return true;
      });

      setOrders(ords);
      setProducts(prods);
      setPaymentMethods(methods);
      setEmployees(emps);
      setAvailableDeposits(deps);
      setAvailableDrivers(drivers);

    })();
    return () => {
      alive = false;
    };
  }, [view, currentUser?.depositoId, currentUser?.id]);

  // -- Filters --
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (activeTab === 'TODOS') return true;
      if (activeTab === 'PENDENTE') return o.status === 'PENDENTE' || o.status === 'PENDENTE_ENTREGA'; 
      return o.status === activeTab;
    }).sort((a, b) => b.dataHoraCriacao - a.dataHoraCriacao);
  }, [orders, activeTab]);

  const handleStatusChange = async (osId: string, newStatus: StatusOS, motivo?: string) => {
    if (newStatus === 'CANCELADA' && !confirm("Deseja realmente cancelar esta O.S?")) return;
    try {
      await updateServiceOrderStatus(osId, newStatus, motivo);
      setOrders(await listServiceOrders());
    } catch (err) {
      console.error(err);
      toast.error('Nao foi possivel atualizar o status da O.S. Verifique os dados e tente novamente.');
    }
  };

  const handleEdit = async (os: OrdemServico) => {
    try {
      const fullOrder = await serviceOrderService.getById(os.id);
      const mapped = fullOrder ? mapCompleteServiceOrderToDomain(fullOrder) : os;
      setEditingOrder(mapped);
      setView('create');
    } catch (error) {
      console.error('Erro ao carregar O.S. para edicao:', error);
      toast.error('Nao foi possivel carregar a O.S. para edicao.');
    }
  };

  const handleCreateNew = () => {
    setEditingOrder(null);
    setView('create');
  };

  if (view === 'create') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div
          className="w-full max-w-[1200px] h-[90vh] bg-white rounded shadow-2xl border border-gray-300 flex flex-col overflow-hidden"
          style={{
            // Força tema claro dentro do modal, aproximando do layout ERP
            ['--app-bg' as any]: '#f7f7f7',
            ['--surface-bg' as any]: '#ffffff',
            ['--text-main' as any]: '#1f2937',
            ['--text-muted' as any]: '#4b5563',
            ['--border-color' as any]: '#cbd5e1',
            ['--primary' as any]: '#0b3a64',
          }}
        >
          <div className="bg-gray-800 px-5 py-3 border-b border-gray-300 flex justify-between items-center shrink-0 text-white">
            <h2 className="text-lg font-bold uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-300" /> Nova Ordem de Serviço
            </h2>
            <button onClick={handleCancel} className="text-gray-200 hover:text-white p-2 rounded">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-[#f2f2f2]">
            <div className="bg-white border border-gray-300 rounded-md h-full overflow-y-auto px-3 py-4 shadow-sm text-black">
              <OrderCreationForm
                onCancel={handleCancel}
                onSuccess={handleSuccess}
                initialData={editingOrder}
                currentUser={currentUser}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-surface border-b border-bdr px-6 py-4 flex flex-col sm:flex-row justify-between items-center shadow-sm shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
            <ClipboardList className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Gestão de Ordens de Serviço</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Acompanhamento Operacional</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCreateNew}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" /> NOVA O.S
          </button>
          <div className="h-8 w-px bg-bdr mx-2 hidden sm:block"></div>
          <button onClick={onClose} className="p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="bg-surface border-b border-bdr px-6">
        <div className="flex gap-6 overflow-x-auto">
          {[
            { id: 'PENDENTE', label: 'Pendentes (Geral)', cor: 'text-amber-500 border-amber-500', icon: Clock },
            { id: 'PENDENTE_ENTREGA', label: 'Aguardando Entrega', cor: 'text-orange-500 border-orange-500', icon: Bike },
            { id: 'EM_ANDAMENTO', label: 'Em Trânsito/Andamento', cor: 'text-blue-500 border-blue-500', icon: Truck },
            { id: 'CONCLUIDA', label: 'Concluídas', cor: 'text-green-500 border-green-500', icon: CheckCircle2 },
            { id: 'CANCELADA', label: 'Canceladas', cor: 'text-red-500 border-red-500', icon: Ban },
            { id: 'TODOS', label: 'Todas', cor: 'text-txt-main border-txt-main', icon: Filter },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-4 pt-4 text-sm font-bold border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive ? tab.cor : 'border-transparent text-txt-muted hover:text-txt-main'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-app">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-txt-muted opacity-50">
               <ClipboardList className="w-16 h-16 mb-4" />
               <p className="font-bold text-lg">Nenhuma O.S encontrada nesta categoria.</p>
            </div>
          ) : (
            filteredOrders.map(os => (
              <div key={os.id} className="bg-surface rounded-2xl p-5 border border-bdr shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group relative">
                 <div className="absolute top-5 right-5 md:static md:order-last flex flex-col items-end gap-2">
                    <OsTimer createdAt={os.dataHoraCriacao} status={os.status} />
                    <button 
                      onClick={() => setTimelineOrder(os)} 
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                       <History className="w-3 h-3" /> Ver Histórico
                    </button>
                 </div>

                 <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
                       os.status === 'PENDENTE' ? 'bg-amber-100 text-amber-600' :
                       os.status === 'PENDENTE_ENTREGA' ? 'bg-orange-100 text-orange-600' :
                       os.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-600' :
                       os.status === 'CONCLUIDA' ? 'bg-green-100 text-green-600' :
                       'bg-red-100 text-red-600'
                    }`}>
                       {os.status === 'PENDENTE' && <Clock className="w-6 h-6" />}
                       {os.status === 'PENDENTE_ENTREGA' && <Bike className="w-6 h-6" />}
                       {os.status === 'EM_ANDAMENTO' && <Truck className="w-6 h-6" />}
                       {os.status === 'CONCLUIDA' && <CheckCircle2 className="w-6 h-6" />}
                       {os.status === 'CANCELADA' && <Ban className="w-6 h-6" />}
                    </div>
                    
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-txt-muted bg-app px-2 py-0.5 rounded">#{os.numeroOs}</span>
                          <span className="text-[10px] font-black uppercase text-txt-muted">{new Date(os.dataHoraCriacao).toLocaleTimeString().slice(0,5)}</span>
                          {os.tipoAtendimento && (
                             <span className="text-[9px] font-bold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">{os.tipoAtendimento}</span>
                          )}
                       </div>
                       <h3 className="font-black text-lg text-txt-main">{os.clienteNome}</h3>
                       <div className="flex items-center gap-1 text-xs text-txt-muted mb-2">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-md">{os.enderecoEntrega || 'Endereço não informado'}</span>
                       </div>
                       <div className="flex flex-wrap gap-2 mt-2">
                          {(os.itens ?? []).length === 0 ? (
                            <span className="text-xs font-bold text-txt-muted bg-app px-2 py-1 rounded border border-bdr">
                              Itens indisponiveis
                            </span>
                          ) : (
                            (os.itens ?? []).map((item, idx) => (
                              <span key={idx} className="text-xs font-bold text-txt-muted bg-app px-2 py-1 rounded border border-bdr">
                                {item.quantidade}x {products.find(p => p.id === item.produtoId)?.nome}
                              </span>
                            ))
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-col items-end gap-3 min-w-[150px] mt-4 md:mt-0">
                    <span className="text-xl font-black text-primary">R$ {os.total.toFixed(2)}</span>
                    
                    <div className="flex items-center gap-2 opacity-100 transition-opacity">
                      {os.status !== 'CANCELADA' && os.status !== 'CONCLUIDA' && (
                        <>
                          <button
                            onClick={() => handleEdit(os)}
                            className="px-3 py-1.5 bg-surface border border-bdr hover:bg-app text-txt-main rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"
                            title="Editar O.S"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>

                          <button
                            onClick={() => handleStatusChange(os.id, 'CONCLUIDA', 'Conclusao manual')}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                            title="Concluir e lancar financeiro/estoque"
                          >
                            Concluir <CheckCircle2 className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => handleStatusChange(os.id, 'CANCELADA', 'Cancelamento Manual')}
                            className="px-3 py-1.5 bg-app border border-bdr hover:bg-red-50 hover:text-red-500 text-txt-muted rounded-lg text-xs font-bold shadow-sm"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      {timelineOrder && (
         <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-3xl rounded-2xl shadow-2xl border border-bdr p-6 space-y-6">
               <div className="flex justify-between items-center border-b border-bdr pb-4">
                  <h3 className="text-lg font-black text-txt-main flex items-center gap-2">
                     <Activity className="w-5 h-5 text-primary" /> Detalhes da O.S #{timelineOrder.numeroOs}
                  </h3>
                  <button onClick={() => setTimelineOrder(null)} className="p-1 hover:bg-app rounded-full"><X className="w-5 h-5" /></button>
               </div>

               <div className="grid md:grid-cols-2 gap-4">
                 <div className="rounded-xl border border-bdr bg-app px-4 py-3 space-y-2">
                   <p className="text-xs font-bold text-txt-muted uppercase">Cliente</p>
                   <p className="text-sm font-black text-txt-main">{timelineOrder.clienteNome}</p>
                   <p className="text-xs text-txt-muted">{timelineOrder.enderecoEntrega || 'Endereco nao informado'}</p>
                   <div className="flex gap-2 text-[10px] text-txt-muted uppercase font-bold">
                     <span className="bg-primary/10 text-primary px-2 py-1 rounded">{timelineOrder.tipoAtendimento}</span>
                     {timelineOrder.entregadorId && (
                       <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded">Entregador: {resolveEmployeeName(timelineOrder.entregadorId)}</span>
                     )}
                   </div>
                 </div>

                 <div className="rounded-xl border border-bdr bg-app px-4 py-3 space-y-2">
                   <p className="text-xs font-bold text-txt-muted uppercase">Resumo financeiro</p>
                   <div className="flex items-center justify-between text-sm font-black">
                     <span className="text-txt-muted">Total</span>
                     <span className="text-primary">{fmtCurrency(timelineOrder.total)}</span>
                   </div>
                   <div className="space-y-1">
                     {(timelineOrder.pagamentos || []).length === 0 ? (
                       <div className="flex items-center justify-between text-xs font-bold text-txt-muted bg-surface px-3 py-2 rounded border border-bdr">
                         <span>Pagamento nao informado</span>
                         <span className="text-txt-main">{fmtCurrency(0)}</span>
                       </div>
                     ) : (
                       (timelineOrder.pagamentos || []).map((p, idx) => {
                         const methodId =
                           (p as any).formaPagamentoId ??
                           (p as any).payment_method_id ??
                           (p as any).paymentMethodId;
                         const amount =
                           (p as any).valor ??
                           (p as any).amount ??
                           (p as any).value ??
                           0;
                         const method = paymentMethods.find((m) => m.id === methodId);
                         return (
                           <div key={idx} className="flex items-center justify-between text-xs font-bold text-txt-muted bg-surface px-3 py-2 rounded border border-bdr">
                             <span>{method?.name ?? method?.nome ?? (methodId || 'Pagamento')}</span>
                             <span className="text-txt-main">{fmtCurrency(amount)}</span>
                           </div>
                         );
                       })
                     )}
                   </div>
                   <div className="text-[10px] text-txt-muted">Status: {timelineOrder.status}</div>
                 </div>
               </div>

               <div className="rounded-xl border border-bdr bg-app px-4 py-3 space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-xs font-bold text-txt-muted uppercase">Itens</p>
                   <span className="text-[11px] font-bold text-primary">{(timelineOrder.itens || []).length} itens</span>
                 </div>
                 <div className="divide-y divide-bdr">
                   {(timelineOrder.itens || []).map((it, idx) => {
                     const prod = products.find((p) => p.id === it.produtoId);
                     const total = it.quantidade * it.precoUnitario;
                     return (
                       <div key={idx} className="py-2 flex items-center justify-between text-sm">
                         <div className="flex flex-col">
                           <span className="font-bold text-txt-main">{prod?.nome || it.produtoId}</span>
                           <span className="text-[11px] text-txt-muted uppercase">Qtd {it.quantidade} - {fmtCurrency(it.precoUnitario)}</span>
                         </div>
                         <span className="font-black text-primary">{fmtCurrency(total)}</span>
                       </div>
                     );
                   })}
                 </div>
               </div>

               <div className="max-h-[45vh] overflow-y-auto">
                  <p className="text-xs font-bold text-txt-muted uppercase mb-2">Linha do tempo</p>
                  <Timeline logs={timelineOrder.historico || []} />
               </div>
            </div>
         </div>
      )}
    </div>
  );
};






