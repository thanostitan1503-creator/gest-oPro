
import React, { useState, useEffect, useMemo, useRef } from 'react';
// ⚠️ REMOVIDO v3.0: useLiveQuery (use useState + useEffect + Services)
import { 
  X, Users, Search, Plus, Trash2, 
  FileText, Save, ChevronRight, Tag, AlertCircle,
  Ban, CheckCircle2, MapPin, Phone, User as UserIcon,
  UserCheck, Receipt
} from 'lucide-react';
import { 
  Cliente, ClientePreco, ClienteDescontoPendente, 
  UserRole, DepositoFisicoId, ModalidadeItem 
} from '@/domain/types';
import { RIO_VERDE_NEIGHBORHOODS } from '@/domain/rioVerdeNeighborhoods';
import {
  clientService,
  deleteClientDiscount,
  deleteClientPriceOverride,
  depositService,
  deliveryService,
  listClientDiscounts,
  listClientPriceOverrides,
  productService,
  saveClientDiscount,
  upsertClientPriceOverride,
  type ClientDiscountInsert,
  type ClientDiscountRow,
  type ClientPriceOverrideInsert,
  type ClientPriceOverrideRow,
  type DeliveryZone,
  type NewClient,
  type Product,
  type UpdateClient,
} from '@/services';
import { normalizeDateForSupabase } from '@/utils/date';
import { toast } from 'sonner';
// ⚠️ REMOVIDO v3.0: db local (use Services: import { xxxService } from '@/services')

// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories

// Funções auxiliares para comunicação com Supabase
const buildFullAddress = (
  street?: string | null,
  neighborhood?: string | null,
  fallback?: string | null
) => {
  const parts = [street?.trim(), neighborhood?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(' - ');
  return (fallback ?? '').trim();
};

const listClients = async (): Promise<Cliente[]> => {
  const data = await clientService.getAll({ includeInactive: true });
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
      criado_em: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
      atualizado_em: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
    };
  });
};

const upsertClient = async (client: Partial<Cliente>): Promise<void> => {
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
    const payload: UpdateClient = basePayload;
    await clientService.update(client.id, payload);
    return;
  }

  const payload: NewClient = {
    ...basePayload,
    created_at: nowIso,
  };
  await clientService.create(payload);
};

const deleteClient = async (id: string): Promise<void> => {
  await clientService.remove(id);
};

const normalizeMovementType = (value?: string | null): ModalidadeItem => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'SIMPLES') return 'SIMPLE';
  if (raw === 'TROCA') return 'EXCHANGE';
  if (raw === 'COMPLETA') return 'FULL';
  if (!raw) return 'SIMPLE';
  return raw;
};

const mapClientPriceOverride = (row: ClientPriceOverrideRow): ClientePreco => {
  const priceRaw = row.special_price;
  const precoEspecial =
    priceRaw === null || priceRaw === undefined ? null : Number(priceRaw);

  return {
    id: row.id,
    clienteId: row.client_id,
    produtoId: row.product_id,
    depositoId: row.deposit_id,
    modalidade: normalizeMovementType(row.modality),
    precoEspecial,
    ativo: row.is_active ?? true,
    atualizado_em: row.updated_at
      ? new Date(row.updated_at).getTime()
      : row.created_at
        ? new Date(row.created_at).getTime()
        : Date.now(),
  };
};

const buildPriceKey = (
  clienteId: string,
  produtoId: string,
  modalidade: ModalidadeItem,
  depositoId: DepositoFisicoId | null
) => {
  const depositKey = depositoId ?? 'GLOBAL';
  return `${clienteId}:${produtoId}:${modalidade}:${depositKey}`;
};

const listClientPrices = async (): Promise<ClientePreco[]> => {
  const data = await listClientPriceOverrides();
  return (data || []).map(mapClientPriceOverride);
};

const saveClientPrice = async (
  payload: ClientPriceOverrideInsert
): Promise<ClientePreco> => {
  const saved = await upsertClientPriceOverride(payload);
  return mapClientPriceOverride(saved);
};

const deleteClientPrice = async (id: string): Promise<void> => {
  await deleteClientPriceOverride(id);
};

const mapClientDiscountRow = (row: ClientDiscountRow): ClienteDescontoPendente => {
  const percentRaw = row.discount_percent;
  const valueRaw = row.discount_value;
  const percentValue =
    percentRaw === null || percentRaw === undefined ? null : Number(percentRaw);
  const valueValue =
    valueRaw === null || valueRaw === undefined ? null : Number(valueRaw);
  const tipoDesconto =
    percentValue !== null && Number.isFinite(percentValue) && percentValue > 0
      ? 'PERCENTUAL'
      : 'VALOR';
  const valorDesconto =
    tipoDesconto === 'PERCENTUAL'
      ? Number.isFinite(percentValue ?? NaN)
        ? Number(percentValue)
        : 0
      : Number.isFinite(valueValue ?? NaN)
        ? Number(valueValue)
        : 0;
  const statusRaw = String(row.status ?? '').trim().toUpperCase();
  const usado =
    !!row.used_at ||
    !!row.used_in_order_id ||
    (statusRaw !== '' && statusRaw !== 'PENDING');

  return {
    id: row.id,
    clienteId: row.client_id,
    depositoId: row.deposit_id ?? null,
    tipoDesconto,
    valorDesconto,
    usado,
    usadoEmOsId: row.used_in_order_id ?? null,
    criado_em: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    usado_em: row.used_at ? new Date(row.used_at).getTime() : null,
  };
};

const listClientDiscountsUI = async (): Promise<ClienteDescontoPendente[]> => {
  const data = await listClientDiscounts();
  return (data || []).map(mapClientDiscountRow);
};

const saveClientDiscountUI = async (
  discount: ClienteDescontoPendente
): Promise<ClienteDescontoPendente> => {
  const rawValue = Number(discount.valorDesconto ?? 0);
  const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
  const isPercentual = discount.tipoDesconto === 'PERCENTUAL';
  const payload: ClientDiscountInsert = {
    id: discount.id,
    client_id: discount.clienteId,
    deposit_id: discount.depositoId ?? null,
    benefit_type: 'DISCOUNT',
    discount_value: isPercentual ? null : safeValue,
    discount_percent: isPercentual ? safeValue : null,
    status: discount.usado ? 'USED' : 'PENDING',
    used_in_order_id: discount.usadoEmOsId ?? null,
    used_at: discount.usado_em
      ? new Date(discount.usado_em).toISOString()
      : null,
  };
  const saved = await saveClientDiscount(payload);
  return mapClientDiscountRow(saved);
};

const deleteClientDiscountUI = async (id: string): Promise<void> => {
  await deleteClientDiscount(id);
};

const listDeposits = async (): Promise<Array<{ id: string; nome: string }>> => {
  const data = await depositService.getAll();
  return (data || []).map((d) => ({ id: d.id, nome: d.name ?? d.id }));
};

interface ClientsModuleProps {
  onClose: () => void;
  userRole: UserRole;
}

// Modalidades de venda baseadas no movement_type do produto
// SIMPLE = Venda simples (só sai do estoque)
// EXCHANGE = Troca (sai cheio, entra vazio)
// FULL = Venda completa (sai cheio + casco, sem retorno)
const MODALIDADES: ModalidadeItem[] = ['SIMPLE', 'EXCHANGE', 'FULL'];
const MODALIDADE_LABELS: Record<string, string> = {
  SIMPLE: 'Simples',
  EXCHANGE: 'Troca',
  FULL: 'Completa',
};
const EMPTY_CLIENT: Partial<Cliente> = {
  nome: '',
  endereco: '',
  streetAddress: '',
  neighborhood: '',
  deliverySectorId: null,
  telefone: '',
  cpf: '',
  referencia: '',
  dataNascimento: '',
  deliveryZoneId: null
};

export const ClientsModule: React.FC<ClientsModuleProps> = ({ onClose, userRole }) => {
  const isAdmin = userRole === 'ADMIN';

  // --- Estados do Banco de Dados ---
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [precos, setPrecos] = useState<ClientePreco[]>([]);
  const [descontos, setDescontos] = useState<ClienteDescontoPendente[]>([]);
  
  // --- Estados de UI ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'precos' | 'desconto'>('dados');
  const [isEditing, setIsEditing] = useState(false);

  // --- Estados de Formulário ---
  const [clientForm, setClientForm] = useState<Partial<Cliente>>(EMPTY_CLIENT);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const neighborhoodSearchRef = useRef<HTMLInputElement>(null);

  const [priceForm, setPriceForm] = useState({
    produtoId: '',
    depositoId: '' as DepositoFisicoId | '',
    depositoScope: 'GLOBAL' as 'GLOBAL' | 'DEPOSIT',
    modalidade: MODALIDADES[0] as ModalidadeItem,
    preco: ''
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [deposits, setDeposits] = useState<Array<{ id: string; nome: string }>>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  const [discountForm, setDiscountForm] = useState<Partial<ClienteDescontoPendente>>({
    tipoDesconto: 'VALOR',
    valorDesconto: 0,
    modalidadeAlvo: null,
    produtoIdAlvo: null
  });

  // --- Carregar Dados ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, p, d] = await Promise.all([
          listClients(),
          listClientPrices(),
          listClientDiscountsUI(),
        ]);
        if (!alive) return;
        setClientes(c);
        setPrecos(p);
        setDescontos(d);
      } catch (error) {
        console.error('Erro ao carregar dados de clientes:', error);
        toast.error('Nao foi possivel carregar dados de clientes.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await productService.getAll();
        if (!alive) return;
        setProducts(data || []);
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        toast.error('Nao foi possivel carregar produtos.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const deps = await listDeposits();
        if (!alive) return;
        setDeposits(deps.map((x) => ({ id: x.id, nome: x.nome })));
      } catch (e) {
        console.error('Erro ao carregar depósitos:', e);
        toast.error('Nao foi possivel carregar depositos.');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Carregar zonas de entrega
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const zones = await deliveryService.getZones();
        if (!alive) return;
        setDeliveryZones(zones || []);
      } catch (e) {
        console.error('Erro ao carregar zonas:', e);
        toast.error('Nao foi possivel carregar zonas de entrega.');
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (neighborhoodOpen) {
      neighborhoodSearchRef.current?.focus();
    }
  }, [neighborhoodOpen]);


  const reloadAll = async () => {
    const [c, p, d] = await Promise.all([
      listClients(),
      listClientPrices(),
      listClientDiscountsUI(),
    ]);
    setClientes(c);
    setPrecos(p);
    setDescontos(d);
  };

  // --- Filtros ---
  const filteredClients = clientes.filter(c => {
    const nome = (c.nome || '').toString().toLowerCase();
    const endereco = (c.endereco || '').toString().toLowerCase();
    const telefone = (c.telefone || '').toString();
    const term = (searchTerm || '').toString().toLowerCase();

    return (
      nome.includes(term) ||
      telefone.includes(searchTerm) ||
      endereco.includes(term)
    );
  });

  const filteredNeighborhoods = useMemo(
    () =>
      RIO_VERDE_NEIGHBORHOODS.filter((b) =>
        b.toLowerCase().includes(neighborhoodSearch.toLowerCase())
      ),
    [neighborhoodSearch]
  );

  const selectedClient = useMemo(() => 
    clientes.find(c => c.id === selectedClientId), 
    [selectedClientId, clientes]
  );

  const clientPrecos = useMemo(() => 
    precos.filter(p => p.clienteId === selectedClientId), 
    [selectedClientId, precos]
  );

  const clientDesconto = useMemo(() => 
    descontos.find(d => d.clienteId === selectedClientId && !d.usado), 
    [selectedClientId, descontos]
  );

  const depositNameById = useMemo(() => {
    return deposits.reduce<Record<string, string>>((acc, deposit) => {
      acc[deposit.id] = deposit.nome;
      return acc;
    }, {});
  }, [deposits]);

  const resolveDepositLabel = (depositoId: DepositoFisicoId | null) => {
    if (!depositoId) return 'GLOBAL';
    return depositNameById[depositoId] ?? depositoId;
  };

  const buildProductLabel = (product: Product) => {
    const code = (product.code ?? '').trim().toUpperCase();
    const name = (product.name ?? '').trim();
    if (code === 'P13') return 'Gás P13';
    if (code === 'P45') return 'Gás P45';
    if (code === 'AGUA20' || code === 'ÁGUA20') return 'Água 20L';
    if (code) return code;
    if (name) return name;
    return product.id;
  };

  const isBaseProduct = (product: Product) => {
    const code = (product.code ?? '').toUpperCase();
    const name = (product.name ?? '').toUpperCase();
    return (
      code.includes('P13') ||
      name.includes('P13') ||
      code.includes('P45') ||
      name.includes('P45') ||
      code.includes('AGUA20') ||
      name.includes('AGUA 20') ||
      name.includes('ÁGUA 20')
    );
  };

  const priceProducts = useMemo(() => {
    const matches = products.filter(isBaseProduct);
    const list = matches.length > 0 ? matches : products;
    return [...list].sort((a, b) =>
      buildProductLabel(a).localeCompare(buildProductLabel(b), 'pt-BR')
    );
  }, [products]);

  const productLabelById = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((product) => {
      map.set(product.id, buildProductLabel(product));
    });
    return map;
  }, [products]);

  useEffect(() => {
    if (priceProducts.length === 0) return;
    setPriceForm((prev) => {
      const exists = priceProducts.some((product) => product.id === prev.produtoId);
      if (exists) return prev;
      return { ...prev, produtoId: priceProducts[0].id };
    });
  }, [priceProducts]);

  // --- Ações de Cliente ---
  const handleNewClient = () => {
    setSelectedClientId(null);
    setClientForm(EMPTY_CLIENT);
    setIsEditing(true);
    setActiveTab('dados');
  };

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    const client = clientes.find(c => c.id === id);
    if (client) {
      setClientForm(client);
      setIsEditing(false);
    }
  };

  const saveClient = async () => {
    const streetAddress = (clientForm.streetAddress || '').trim();
    const neighborhood = (clientForm.neighborhood || '').trim();
    if (!clientForm.nome || !streetAddress || !neighborhood) {
      toast.error('Preencha Nome, Logradouro e Bairro/Setor.');
      return;
    }
    const endereco = buildFullAddress(streetAddress, neighborhood, clientForm.endereco);

    const now = Date.now();
    try {
      if (selectedClientId) {
        await upsertClient({
          id: selectedClientId,
          nome: clientForm.nome,
          endereco,
          streetAddress,
          neighborhood,
          deliverySectorId: clientForm.deliverySectorId ?? null,
          telefone: clientForm.telefone,
          cpf: clientForm.cpf,
          referencia: clientForm.referencia,
          dataNascimento: clientForm.dataNascimento,
          deliveryZoneId: clientForm.deliveryZoneId ?? null,
          ativo: clientForm.ativo ?? true,
          criado_em: (clientes.find(c => c.id === selectedClientId)?.criado_em) ?? now,
          atualizado_em: now,
        });
      } else {
        await upsertClient({
          nome: clientForm.nome,
          endereco,
          streetAddress,
          neighborhood,
          deliverySectorId: clientForm.deliverySectorId ?? null,
          telefone: clientForm.telefone,
          cpf: clientForm.cpf,
          referencia: clientForm.referencia,
          dataNascimento: clientForm.dataNascimento,
          deliveryZoneId: clientForm.deliveryZoneId ?? null,
          ativo: true,
          criado_em: now,
          atualizado_em: now,
        });
      }

      await reloadAll();
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Nao foi possivel salvar o cliente.');
    }
  };

  const toggleStatus = async () => {
    if (!selectedClientId) return;
    const current = clientes.find(c => c.id === selectedClientId);
    if (!current) return;
    try {
      await upsertClient({
        ...current,
        ativo: !current.ativo,
        atualizado_em: Date.now(),
      } as any);
      await reloadAll();
    } catch (error) {
      console.error('Erro ao atualizar status do cliente:', error);
      toast.error('Nao foi possivel atualizar o status do cliente.');
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClientId) return;
    const client = clientes.find(c => c.id === selectedClientId);
    const name = client?.nome || 'cliente';
    const confirmed = window.confirm(`Excluir permanentemente ${name}? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;

    try {
      await deleteClient(selectedClientId);
      await reloadAll();
      setSelectedClientId(null);
      setClientForm(EMPTY_CLIENT);
      setIsEditing(false);
      setActiveTab('dados');
    } catch (error) {
      console.error('Erro ao remover cliente:', error);
      toast.error('Nao foi possivel remover o cliente.');
    }
  };

  // --- Ações de Preço ---
  const addPrice = async () => {
    if (!selectedClientId) return;
    if (!priceForm.produtoId) {
      toast.error('Selecione um produto base.');
      return;
    }
    if (priceForm.preco === '') {
      toast.error('Informe um valor válido para o preço especial.');
      return;
    }
    const preco = Number(priceForm.preco);
    if (!Number.isFinite(preco)) {
      toast.error('Informe um valor válido para o preço especial.');
      return;
    }

    const isGlobal = priceForm.depositoScope === 'GLOBAL';
    const depositoId = isGlobal ? null : (priceForm.depositoId || null);
    if (!isGlobal && !depositoId) {
      toast.error('Selecione um depósito específico.');
      return;
    }

    const payload: ClientPriceOverrideInsert = {
      client_id: selectedClientId,
      product_id: priceForm.produtoId,
      deposit_id: isGlobal ? null : depositoId,
      modality: normalizeMovementType(priceForm.modalidade),
      special_price: preco,
      is_active: true,
    };

    try {
      const savedPrice = await saveClientPrice(payload);
      const savedKey = buildPriceKey(
        savedPrice.clienteId,
        savedPrice.produtoId,
        savedPrice.modalidade,
        savedPrice.depositoId
      );

      setPrecos((prev) => {
        const index = prev.findIndex((price) => {
          return (
            buildPriceKey(
              price.clienteId,
              price.produtoId,
              price.modalidade,
              price.depositoId
            ) === savedKey
          );
        });
        if (index === -1) return [...prev, savedPrice];
        const next = [...prev];
        next[index] = savedPrice;
        return next;
      });
      setPriceForm((prev) => ({ ...prev, preco: '' }));
    } catch (error) {
      console.error('Erro ao salvar preço especial:', error);
      toast.error('Não foi possível salvar o preço especial.');
    }
  };

  const deletePrice = async (id: string) => {
    try {
      await deleteClientPrice(id);
      setPrecos((prev) => prev.filter((price) => price.id !== id));
    } catch (error) {
      console.error('Erro ao remover preço especial:', error);
      toast.error('Não foi possível remover o preço especial.');
    }
  };

  // --- Ações de Desconto ---
  const saveDiscount = async () => {
    if (!selectedClientId) return;
    
    const newDiscount: ClienteDescontoPendente = {
      id: crypto.randomUUID(),
      clienteId: selectedClientId,
      depositoId: null,
      tipoDesconto: discountForm.tipoDesconto as 'VALOR' | 'PERCENTUAL',
      valorDesconto: discountForm.valorDesconto || 0,
      usado: false,
      criado_em: Date.now()
    };

    try {
      await saveClientDiscountUI(newDiscount);
      await reloadAll();
      toast.success('Desconto pendente salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar desconto pendente:', error);
      toast.error('Nao foi possivel salvar o desconto pendente.');
    }
  };

  const disableDiscount = async () => {
    if (!clientDesconto) return;
    const confirmed = window.confirm('Remover o bônus pendente deste cliente?');
    if (!confirmed) return;

    try {
      await deleteClientDiscountUI(clientDesconto.id);
      await reloadAll();
      toast.success('Bonus desativado com sucesso.');
    } catch (error) {
      console.error('Erro ao remover bonus pendente:', error);
      toast.error('Nao foi possivel desativar o bonus pendente.');
    }
  };

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm z-10 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl shadow-sm border border-primary/20">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-txt-main tracking-tighter">Clientes & Precificação</h2>
            <p className="text-xs text-primary font-bold uppercase tracking-widest">Painel Administrativo Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Search className="w-4 h-4 text-primary absolute left-3 top-3 group-focus-within:scale-110 transition-transform" />
            <input 
              type="text" 
              placeholder="Localizar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-app border border-bdr rounded-xl text-sm text-txt-main font-bold placeholder:text-txt-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none w-72 transition-all" 
            />
          </div>
          <button 
            onClick={handleNewClient} 
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" /> NOVO CLIENTE
          </button>
          <button onClick={onClose} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-txt-muted transition-all active:rotate-90">
            <X className="w-7 h-7" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex p-6 gap-6">
        {/* Lista de Clientes (Coluna Esquerda) */}
        <div className="w-1/3 bg-surface rounded-3xl shadow-lg border border-bdr flex flex-col overflow-hidden transition-colors">
          <div className="p-5 bg-app/50 border-b border-bdr flex items-center justify-between">
            <span className="text-[10px] font-black text-txt-muted uppercase tracking-[0.2em]">Registros Ativos</span>
            <span className="bg-primary/10 text-primary text-xs font-black px-2 py-0.5 rounded-full">{filteredClients.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-bdr no-scrollbar">
            {filteredClients.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center h-full opacity-40">
                <Users className="w-16 h-16 text-txt-muted mb-4" />
                <p className="text-txt-muted font-black italic text-sm">Nenhum cliente disponível</p>
              </div>
            ) : (
              filteredClients.map(c => (
                <button 
                  key={c.id}
                  onClick={() => handleSelectClient(c.id)}
                  className={`w-full text-left p-6 hover:bg-app transition-all flex justify-between items-center group relative ${selectedClientId === c.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                >
                  <div className="space-y-1.5">
                    <h4 className={`font-black text-lg transition-colors ${selectedClientId === c.id ? 'text-primary' : 'text-txt-main'}`}>
                      {c.nome} {!c.ativo && <span className="text-[10px] text-white font-black ml-2 uppercase px-2 py-0.5 bg-red-600 rounded-md">Inativo</span>}
                    </h4>
                    <p className="text-xs text-txt-muted font-bold truncate w-64 uppercase tracking-tight">{c.endereco}</p>
                    <div className="flex gap-2">
                       {precos.some(p => p.clienteId === c.id) && <span className="text-[9px] font-black bg-amber-500 text-white px-2.5 py-1 rounded shadow-md uppercase tracking-widest">Precificado</span>}
                       {descontos.some(d => d.clienteId === c.id && !d.usado) && <span className="text-[9px] font-black bg-emerald-500 text-white px-2.5 py-1 rounded shadow-md uppercase tracking-widest">Bonus</span>}
                    </div>
                  </div>
                  <ChevronRight className={`w-6 h-6 transition-all ${selectedClientId === c.id ? 'translate-x-2 text-primary opacity-100 scale-125' : 'text-txt-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detalhes e Configurações (Coluna Direita) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedClientId && !isEditing ? (
            <div className="flex-1 bg-surface rounded-3xl border-4 border-dashed border-bdr flex flex-col items-center justify-center text-txt-muted p-12 text-center shadow-inner group transition-colors">
              <div className="bg-app p-10 rounded-[2.5rem] mb-8 border-2 border-bdr group-hover:scale-110 transition-transform duration-500">
                <Users className="w-20 h-20 text-primary/30" />
              </div>
              <p className="font-black text-2xl text-txt-main tracking-tight">Nenhum Registro Selecionado</p>
              <p className="text-sm mt-3 max-w-xs font-bold text-txt-muted leading-relaxed">Clique em um cliente da lista ou inicie um novo cadastro para gerenciar suas condições especiais.</p>
            </div>
          ) : (
            <div className="bg-surface rounded-[2.5rem] shadow-2xl border-2 border-bdr flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-10 duration-500 transition-colors">
              
              {/* NAVEGAÇÃO DE ABAS */}
              <div className="px-10 py-6 border-b-2 border-bdr bg-app/50 flex items-center justify-between">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setActiveTab('dados')} 
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'dados' ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105' : 'bg-surface text-txt-muted border border-bdr hover:border-primary/50 hover:text-primary'}`}
                  >
                    <FileText className="w-4 h-4" /> Ficha Cadastral
                  </button>
                  
                  {isAdmin && (
                    <>
                      <button 
                        disabled={!selectedClientId}
                        onClick={() => setActiveTab('precos')} 
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'precos' ? 'bg-amber-500 text-white shadow-xl shadow-amber-200 scale-105' : 'bg-surface text-txt-muted border border-bdr hover:border-amber-400 hover:text-amber-600'}`}
                      >
                        <Receipt className="w-4 h-4" /> Precificação Especial
                      </button>
                      
                      <button 
                        disabled={!selectedClientId}
                        onClick={() => setActiveTab('desconto')} 
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'desconto' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 scale-105' : 'bg-surface text-txt-muted border border-bdr hover:border-emerald-400 hover:text-emerald-600'}`}
                      >
                        <Tag className="w-4 h-4" /> Bonificações
                      </button>
                    </>
                  )}
                </div>
                
                {selectedClientId && (
                  <div className="bg-surface px-4 py-2 rounded-xl border border-bdr flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest">ID: {selectedClientId.split('-')[0]}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-12 no-scrollbar">
                {activeTab === 'dados' && (
                  <div className="space-y-12 max-w-4xl animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 gap-10">
                       <div className="col-span-2 group">
                         <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Nome Completo / Razão Social *</label>
                         <div className="relative">
                            <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-txt-muted group-focus-within:text-primary transition-colors" />
                            <input 
                              type="text" 
                              value={clientForm.nome} 
                              onChange={e => setClientForm({...clientForm, nome: e.target.value})}
                              placeholder="NOME DO CLIENTE"
                              className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 pl-14 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all placeholder:text-txt-muted/50 uppercase" 
                            />
                         </div>
                       </div>
                       
                       <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="group">
                           <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Logradouro / numero *</label>
                           <div className="relative">
                              <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-txt-muted group-focus-within:text-primary transition-colors" />
                              <input 
                                type="text" 
                                value={clientForm.streetAddress ?? ''} 
                                onChange={e => setClientForm({ ...clientForm, streetAddress: e.target.value })}
                                placeholder="Ex: Rua das Flores, 123"
                                className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 pl-14 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all placeholder:text-txt-muted/50" 
                              />
                           </div>
                         </div>

                         <div className="group">
                           <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Bairro / setor *</label>
                           <div className="relative">
                             <button
                               type="button"
                               onClick={() => setNeighborhoodOpen((open) => !open)}
                               className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 text-base font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all text-left"
                             >
                               <span className={clientForm.neighborhood ? 'text-txt-main' : 'text-txt-muted/50'}>
                                 {clientForm.neighborhood || 'Selecione o bairro / setor'}
                               </span>
                             </button>
                             {neighborhoodOpen && (
                               <div className="absolute z-20 mt-2 w-full rounded-[1.25rem] border-2 border-bdr bg-app shadow-lg">
                                 <div className="p-3 border-b border-bdr">
                                   <input
                                     ref={neighborhoodSearchRef}
                                     type="text"
                                     value={neighborhoodSearch}
                                     onChange={(e) => setNeighborhoodSearch(e.target.value)}
                                     placeholder="Buscar bairro..."
                                     className="w-full bg-surface border-2 border-bdr rounded-xl p-3 text-sm text-txt-main font-black outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                   />
                                 </div>
                                 <div className="max-h-64 overflow-y-auto">
                                   {filteredNeighborhoods.length === 0 ? (
                                     <div className="px-4 py-3 text-xs text-txt-muted">Nenhum bairro encontrado</div>
                                   ) : (
                                     filteredNeighborhoods.map((bairro) => (
                                       <button
                                         key={bairro}
                                         type="button"
                                         onClick={() => {
                                           setClientForm((prev) => ({ ...prev, neighborhood: bairro }));
                                           setNeighborhoodOpen(false);
                                           setNeighborhoodSearch('');
                                         }}
                                         className="w-full text-left px-4 py-3 text-sm text-txt-main font-black hover:bg-bdr transition-colors"
                                       >
                                         {bairro}
                                       </button>
                                     ))
                                   )}
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>

                       <div className="col-span-2 group">
                         <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Zona de entrega</label>
                         <select
                           value={clientForm.deliveryZoneId ?? ''}
                           onChange={(e) => setClientForm({ ...clientForm, deliveryZoneId: e.target.value || null })}
                           className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all"
                         >
                           <option value="">Sem zona definida</option>
                           {deliveryZones.map((zone) => (
                             <option key={zone.id} value={zone.id}>
                               {zone.name ?? zone.id}
                             </option>
                           ))}
                         </select>
                       </div>

                       <div className="group">
                         <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Telefone Principal</label>
                         <div className="relative">
                            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-txt-muted group-focus-within:text-primary transition-colors" />
                            <input 
                              type="text" 
                              value={clientForm.telefone} 
                              onChange={e => setClientForm({...clientForm, telefone: e.target.value})}
                              placeholder="(00) 00000-0000"
                              className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 pl-14 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all placeholder:text-txt-muted/50" 
                            />
                         </div>
                       </div>

                       <div className="group">
                         <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Identificação (CPF/CNPJ)</label>
                         <div className="relative">
                            <FileText className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-txt-muted group-focus-within:text-primary transition-colors" />
                            <input 
                              type="text" 
                              value={clientForm.cpf} 
                              onChange={e => setClientForm({...clientForm, cpf: e.target.value})}
                              placeholder="DOCUMENTO"
                              className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 pl-14 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all placeholder:text-txt-muted/50" 
                            />
                         </div>
                       </div>

                       <div className="group">
                         <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Ponto de Referência</label>
                         <input 
                           type="text" 
                           value={clientForm.referencia} 
                           onChange={e => setClientForm({...clientForm, referencia: e.target.value})}
                           placeholder="EX: PRÓXIMO À PADARIA"
                           className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all placeholder:text-txt-muted/50 uppercase" 
                         />
                       </div>

                       <div className="group">
                         <label className="block text-[11px] font-black text-primary uppercase mb-3 tracking-[0.2em] ml-1">Data Comemorativa</label>
                         <input 
                           type="date" 
                           value={clientForm.dataNascimento} 
                           onChange={e => setClientForm({...clientForm, dataNascimento: e.target.value})}
                           className="w-full bg-app border-2 border-bdr rounded-[1.25rem] p-5 text-base text-txt-main font-black focus:ring-4 focus:ring-primary/10 focus:bg-surface focus:border-primary outline-none shadow-sm transition-all" 
                         />
                       </div>
                    </div>

                    <div className="flex gap-6 pt-12 border-t-2 border-bdr items-center justify-between">
                      <div className="flex gap-6">
                        <button 
                          onClick={saveClient} 
                          className="bg-primary hover:bg-primary/90 text-white px-12 py-5 rounded-[1.5rem] font-black text-sm shadow-2xl shadow-primary/20 flex items-center gap-3 transition-all active:scale-95"
                        >
                          <Save className="w-6 h-6" /> CONFIRMAR CADASTRO
                        </button>
                        
                        {isAdmin && selectedClientId && (
                          <button 
                            onClick={toggleStatus} 
                            className={`px-10 py-5 rounded-[1.5rem] font-black text-sm border-2 transition-all active:scale-95 flex items-center gap-3 ${selectedClient?.ativo ? 'text-red-500 border-red-200 bg-red-500/10 hover:bg-red-500/20' : 'text-emerald-500 border-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20'}`}
                          >
                            {selectedClient?.ativo ? <Ban className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            {selectedClient?.ativo ? 'DESATIVAR REGISTRO' : 'REATIVAR REGISTRO'}
                          </button>
                        )}

                        {isAdmin && selectedClientId && (
                          <button
                            onClick={handleDeleteClient}
                            className="px-10 py-5 rounded-[1.5rem] font-black text-sm border-2 border-red-300 text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-3"
                          >
                            <Trash2 className="w-5 h-5" /> EXCLUIR PERMANENTEMENTE
                          </button>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest mb-1">Status do Registro</p>
                        <p className="text-xs font-black text-primary uppercase">{selectedClientId ? 'CLIENTE CADASTRADO' : 'AGUARDANDO NOVO REGISTRO'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'precos' && isAdmin && (
                  <div className="space-y-12 animate-in fade-in duration-500">
                    <div className="bg-app/50 p-10 rounded-[2.5rem] border-2 border-amber-100/50 grid grid-cols-4 gap-8 items-end shadow-inner">
                       <div className="group">
                         <label className="block text-[11px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Produto Base</label>
                         <select 
                           value={priceForm.produtoId} 
                           onChange={e => setPriceForm({...priceForm, produtoId: e.target.value})} 
                           className="w-full bg-surface border-2 border-amber-200 rounded-2xl p-4 text-sm text-txt-main font-black focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none shadow-sm transition-all"
                         >
                           {priceProducts.length === 0 ? (
                             <option value="">Carregando produtos...</option>
                           ) : (
                             priceProducts.map((product) => (
                               <option key={product.id} value={product.id}>
                                 {buildProductLabel(product)}
                               </option>
                             ))
                           )}
                         </select>
                       </div>
                       
                       <div className="group">
                         <label className="block text-[11px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Alvo de Estoque</label>
                         <div className="flex flex-wrap items-center gap-4 mb-3">
                           <label className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                             <input
                               type="radio"
                               name="priceScope"
                               className="accent-amber-600"
                               checked={priceForm.depositoScope === 'GLOBAL'}
                               onChange={() =>
                                 setPriceForm((prev) => ({ ...prev, depositoScope: 'GLOBAL' }))
                               }
                             />
                             Todos os depósitos
                           </label>
                           <label className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                             <input
                               type="radio"
                               name="priceScope"
                               className="accent-amber-600"
                               checked={priceForm.depositoScope === 'DEPOSIT'}
                               onChange={() =>
                                 setPriceForm((prev) => ({
                                   ...prev,
                                   depositoScope: 'DEPOSIT',
                                   depositoId: prev.depositoId || deposits[0]?.id || '',
                                 }))
                               }
                             />
                             Depósito específico
                           </label>
                         </div>
                         <select 
                           value={priceForm.depositoId} 
                           onChange={e => setPriceForm({...priceForm, depositoId: e.target.value as any})} 
                           disabled={priceForm.depositoScope === 'GLOBAL'}
                           className="w-full bg-surface border-2 border-amber-200 rounded-2xl p-4 text-sm text-txt-main font-black focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                         >
                           <option value="">Selecione um depósito</option>
                           {deposits.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                         </select>
                       </div>
                       
                       <div className="group">
                         <label className="block text-[11px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Tipo de Venda</label>
                         <select 
                           value={priceForm.modalidade} 
                           onChange={e => setPriceForm({...priceForm, modalidade: e.target.value as any})} 
                           className="w-full bg-surface border-2 border-amber-200 rounded-2xl p-4 text-sm text-txt-main font-black focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none shadow-sm transition-all"
                         >
                           {MODALIDADES.map((m) => (
                             <option key={m} value={m}>
                               {MODALIDADE_LABELS[m] ?? m}
                             </option>
                           ))}
                         </select>
                       </div>
                       
                       <div className="flex gap-4">
                         <div className="flex-1 group">
                           <label className="block text-[11px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Valor Unitário</label>
                           <div className="relative">
                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600 font-black text-sm">R$</span>
                             <input 
                               type="number" 
                               value={priceForm.preco} 
                               onChange={e => setPriceForm({...priceForm, preco: e.target.value})} 
                               placeholder="0,00" 
                               className="w-full border-2 border-amber-200 rounded-2xl p-4 pl-10 text-sm text-txt-main font-black focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none shadow-sm transition-all" 
                             />
                           </div>
                         </div>
                         <button 
                           onClick={addPrice} 
                           className="bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-2xl shadow-xl shadow-amber-200 flex items-center justify-center active:scale-90 transition-all"
                         >
                           <Plus className="w-7 h-7" strokeWidth={3} />
                         </button>
                       </div>
                    </div>

                    <div className="bg-surface border-2 border-bdr rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <table className="w-full text-left">
                        <thead className="bg-txt-main text-[10px] font-black text-surface uppercase tracking-[0.3em]">
                          <tr>
                            <th className="px-10 py-6">Item Base</th>
                            <th className="px-10 py-6">Depósito Alvo</th>
                            <th className="px-10 py-6">Modalidade</th>
                            <th className="px-10 py-6 text-right">Valor Líquido</th>
                            <th className="px-10 py-6 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-bdr">
                          {clientPrecos.length === 0 ? (
                            <tr><td colSpan={5} className="px-10 py-24 text-center text-txt-muted font-black italic text-sm">NENHUMA CONDIÇÃO ESPECIAL DEFINIDA</td></tr>
                          ) : (
                            clientPrecos.map(p => (
                              <tr key={p.id} className="hover:bg-app transition-all group">
                                <td className="px-10 py-6 font-black text-txt-main text-base">
                                  {productLabelById.get(p.produtoId) ?? p.produtoId}
                                </td>
                                <td className="px-10 py-6 text-txt-muted font-black text-xs uppercase tracking-widest">
                                  {resolveDepositLabel(p.depositoId)}
                                </td>
                                <td className="px-10 py-6">
                                  <span className="px-3 py-1.5 bg-amber-500/10 text-amber-600 text-[10px] font-black rounded-lg border-2 border-amber-500/20 uppercase tracking-widest">
                                    {MODALIDADE_LABELS[p.modalidade] ?? p.modalidade}
                                  </span>
                                </td>
                                <td className="px-10 py-6 text-right font-black text-amber-500 text-xl tracking-tighter">R$ {p.precoEspecial?.toFixed(2)}</td>
                                <td className="px-10 py-6 text-center">
                                  <button onClick={() => deletePrice(p.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-3 rounded-xl transition-all"><Trash2 className="w-6 h-6" /></button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'desconto' && isAdmin && (
                  <div className="space-y-12 animate-in fade-in duration-500 flex flex-col items-center">
                     <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 p-12 rounded-[3.5rem] w-full max-w-3xl shadow-2xl shadow-emerald-200/50 relative overflow-hidden group">
                        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full group-hover:scale-125 transition-transform duration-700" />
                        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-black/10 rounded-full" />
                        
                        <div className="flex items-center gap-8 mb-12 relative z-10">
                           <div className="bg-white p-5 rounded-[1.75rem] shadow-2xl">
                              <Tag className="w-10 h-10 text-emerald-700" strokeWidth={3} />
                           </div>
                           <div>
                              <h4 className="text-3xl font-black text-white tracking-tighter">Benefício de Bonificação</h4>
                              <p className="text-emerald-100 font-bold opacity-80 uppercase text-[10px] tracking-[0.2em] mt-1">Aplicação única na próxima O.S.</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10 mb-12 relative z-10">
                           <div className="space-y-3">
                             <label className="block text-[11px] font-black text-emerald-200 uppercase tracking-widest ml-1">Modalidade do Cupom</label>
                             <select 
                               value={discountForm.tipoDesconto} 
                               onChange={e => setDiscountForm({...discountForm,tipoDesconto: e.target.value as any})} 
                               className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-5 text-base text-white font-black focus:ring-8 focus:ring-white/5 focus:bg-white focus:text-emerald-900 outline-none shadow-inner transition-all backdrop-blur-md"
                             >
                               <option value="VALOR">VALOR FIXO (R$)</option>
                               <option value="PERCENTUAL">PERCENTUAL (%)</option>
                             </select>
                           </div>
                           

                        <div className="mb-8 bg-white/5 border-2 border-white/10 rounded-3xl p-6 text-white flex items-center justify-between gap-4 shadow-inner relative z-10">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-white/70">Status do bônus</p>
                            {clientDesconto ? (
                              <p className="text-sm font-black text-white mt-1">
                                Bônus pendente de {clientDesconto.tipoDesconto === 'VALOR' ? `R$ ${clientDesconto.valorDesconto.toFixed(2)}` : `${clientDesconto.valorDesconto}%`} para a próxima O.S.
                              </p>
                            ) : (
                              <p className="text-sm font-black text-white mt-1">Nenhum bônus pendente para este cliente.</p>
                            )}
                          </div>
                          {clientDesconto && (
                            <button
                              onClick={disableDiscount}
                              className="px-5 py-3 rounded-2xl font-black text-sm bg-red-500/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/30 transition-all active:scale-95"
                            >
                              DESABILITAR BÔNUS
                            </button>
                          )}
                        </div>
                           <div className="space-y-3">
                             <label className="block text-[11px] font-black text-emerald-200 uppercase tracking-widest ml-1">Carga do Benefício</label>
                             <div className="relative">
                               <input 
                                 type="number" 
                                 value={
                                   Number.isFinite(discountForm.valorDesconto as number)
                                     ? discountForm.valorDesconto
                                     : ''
                                 } 
                                 onChange={(e) => {
                                   const raw = e.target.value;
                                   const parsed = Number(raw);
                                   setDiscountForm({
                                     ...discountForm,
                                     valorDesconto:
                                       raw === '' || !Number.isFinite(parsed) ? undefined : parsed,
                                   });
                                 }} 
                                 className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-5 text-2xl text-white font-black focus:ring-8 focus:ring-white/5 focus:bg-white focus:text-emerald-900 outline-none shadow-inner transition-all backdrop-blur-md" 
                               />
                               <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-white/50 text-xl group-focus-within:text-emerald-500">
                                 {discountForm.tipoDesconto === 'VALOR' ? 'R$' : '%'}
                               </span>
                             </div>
                           </div>
                        </div>

                        <button 
                          onClick={saveDiscount} 
                          className="w-full bg-white hover:bg-emerald-50 text-emerald-900 font-black py-6 rounded-3xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 text-lg relative z-10 group"
                        >
                           <UserCheck className="w-7 h-7 scale-110" strokeWidth={3} /> 
                           ATIVAR BENEFÍCIO AGORA
                        </button>
                     </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
