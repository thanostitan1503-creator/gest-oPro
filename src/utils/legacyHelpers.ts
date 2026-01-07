/**
 * 🔧 LEGACY HELPERS (v3.0 Migration)
 * 
 * Funções auxiliares para substituir chamadas antigas do Dexie
 * por chamadas diretas ao Supabase via services.
 * 
 * ⚠️ TEMPORÁRIO: Este arquivo será removido quando todos os
 * componentes forem refatorados para usar os services diretamente.
 */

import { supabase } from './supabaseClient';
import type { Database } from '@/types/supabase';
import { useState, useEffect } from 'react';

// ==================== STUBS UNIVERSAIS ====================

/**
 * Stub para useLiveQuery do Dexie
 * Converte queries reativas para useState + useEffect
 */
export const useLiveQuery = (fn: any, deps?: any) => {
  const [data, setData] = useState<any>(undefined);

  useEffect(() => {
    const run = async () => {
      if (typeof fn !== 'function') {
        setData([]);
        return;
      }
      try {
        const result = fn();
        if (result && typeof result.then === 'function') {
          const awaited = await result;
          setData(awaited ?? []);
        } else {
          setData(result ?? []);
        }
      } catch (err) {
        console.error('useLiveQuery fallback error:', err);
        setData([]);
      }
    };

    run();
  }, deps || []);

  return data;
};

/**
 * Stub para objeto db do Dexie
 * Fornece interface mínima compatível
 */
export const db: any = {
  deposits: { 
    toArray: async () => {
      const { data } = await supabase.from('deposits').select('*');
      return (data || []).map((d: any) => ({
        id: d.id,
        nome: d.name,
        endereco: d.address,
        ativo: d.active ?? d.is_active,
        cor: d.color,
        require_stock_audit: d.require_stock_audit,
        free_shipping_min_value: d.free_shipping_min_value,
        created_at: d.created_at,
      }));
    },
    filter: () => ({ toArray: async () => [] }),
    get: async (id: string) => {
      const { data } = await supabase.from('deposits').select('*').eq('id', id).single();
      if (!data) return null;
      return {
        id: data.id,
        nome: data.name,
        endereco: data.address,
        ativo: data.active ?? data.is_active,
        cor: data.color,
        require_stock_audit: data.require_stock_audit,
        free_shipping_min_value: data.free_shipping_min_value,
        created_at: data.created_at,
      };
    },
    put: async (deposit: any) => {
      const { error } = await supabase.from('deposits').upsert(deposit);
      if (error) throw error;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('deposits').delete().eq('id', id);
      if (error) throw error;
    },
    bulkAdd: async () => {},
  },
  financial_settings: {
    toCollection: () => ({
      first: async () => {
        try {
          const { data, error } = await supabase.from('financial_settings').select('*').limit(1);
          if (error) throw error;
          return data?.[0] ?? null;
        } catch (err) {
          console.warn('financial_settings fetch fallback (ignored):', err);
          return null;
        }
      },
    }),
  },
  products: { 
    toArray: async () => {
      const { data } = await supabase.from('products').select('*');
      const mapped = (data || []).map((p: any) => {
        // Normalizar tipo: EMPTY_CONTAINER → VASILHAME_VAZIO, etc.
        let tipo = p.type;
        if (tipo === 'EMPTY_CONTAINER') tipo = 'VASILHAME_VAZIO';
        else if (tipo === 'FILLED_GAS') tipo = 'GAS_CHEIO';
        else if (tipo === 'OTHER' || tipo === 'OTHERS') tipo = 'OUTROS';
        
        return {
          id: p.id,
          codigo: p.code || p.codigo || '',
          nome: p.name || p.nome || '',
          descricao: p.description,
          tipo,
          unidade: p.unit,
          preco_venda: p.sale_price,
          preco_custo: p.cost_price,
          preco_troca: p.exchange_price,
          preco_completa: p.full_price,
          movement_type: p.movement_type,
          return_product_id: p.return_product_id,
          track_stock: p.track_stock,
          ativo: p.is_active ?? p.active,
          depositoId: p.deposit_id,
          product_group: p.product_group,
          image_url: p.image_url,
          is_delivery_fee: p.is_delivery_fee,
        };
      });
      return mapped;
    },
    filter: (predicate?: (p: any) => boolean) => ({
      toArray: async () => {
        const all = await db.products.toArray();
        return typeof predicate === 'function' ? all.filter(predicate) : all;
      },
    }),
    get: async (id: string) => {
      const { data } = await supabase.from('products').select('*').eq('id', id).single();
      if (!data) return null;
      
      // Normalizar tipo: EMPTY_CONTAINER → VASILHAME_VAZIO, etc.
      let tipo = data.type;
      if (tipo === 'EMPTY_CONTAINER') tipo = 'VASILHAME_VAZIO';
      else if (tipo === 'FILLED_GAS') tipo = 'GAS_CHEIO';
      else if (tipo === 'OTHER' || tipo === 'OTHERS') tipo = 'OUTROS';
      
      return {
        id: data.id,
        codigo: data.code || data.codigo || '',
        nome: data.name || data.nome || '',
        descricao: data.description,
        tipo,
        unidade: data.unit,
        preco_venda: data.sale_price,
        preco_custo: data.cost_price,
        preco_troca: data.exchange_price,
        preco_completa: data.full_price,
        movement_type: data.movement_type,
        return_product_id: data.return_product_id,
        track_stock: data.track_stock,
        ativo: data.is_active ?? data.active,
        depositoId: data.deposit_id,
        product_group: data.product_group,
        image_url: data.image_url,
        is_delivery_fee: data.is_delivery_fee,
      };
    },
    put: async (product: any) => {
      // Convert PT→EN antes de salvar
      // Normalizar tipo: VASILHAME_VAZIO → EMPTY_CONTAINER, etc.
      let type = product.tipo || product.type;
      if (type === 'VASILHAME_VAZIO') type = 'EMPTY_CONTAINER';
      else if (type === 'GAS_CHEIO') type = 'FILLED_GAS';
      else if (type === 'OUTROS') type = 'OTHER';
      
      const dbProduct = {
        id: product.id,
        code: product.codigo || product.code,
        name: product.nome || product.name,
        description: product.descricao || product.description,
        type,
        unit: product.unidade || product.unit,
        sale_price: product.preco_venda ?? product.sale_price,
        cost_price: product.preco_custo ?? product.cost_price,
        exchange_price: product.preco_troca ?? product.exchange_price,
        full_price: product.preco_completa ?? product.full_price,
        movement_type: product.movement_type,
        return_product_id: product.return_product_id,
        track_stock: product.track_stock,
        is_active: product.ativo ?? product.is_active,
        deposit_id: product.depositoId ?? product.deposit_id,
        product_group: product.product_group,
        image_url: product.image_url,
      };
      const { error } = await supabase.from('products').upsert(dbProduct);
      if (error) throw error;
    },
    update: async (id: string, updates: any) => {
      // Convert PT→EN antes de atualizar
      const dbUpdates: any = {};
      if ('codigo' in updates) dbUpdates.code = updates.codigo;
      if ('code' in updates) dbUpdates.code = updates.code;
      if ('nome' in updates) dbUpdates.name = updates.nome;
      if ('name' in updates) dbUpdates.name = updates.name;
      
      // Normalizar tipo PT→EN
      if ('tipo' in updates) {
        let type = updates.tipo;
        if (type === 'VASILHAME_VAZIO') type = 'EMPTY_CONTAINER';
        else if (type === 'GAS_CHEIO') type = 'FILLED_GAS';
        else if (type === 'OUTROS') type = 'OTHER';
        dbUpdates.type = type;
      }
      if ('type' in updates) dbUpdates.type = updates.type;
      
      if ('unidade' in updates) dbUpdates.unit = updates.unidade;
      if ('unit' in updates) dbUpdates.unit = updates.unit;
      if ('preco_venda' in updates) dbUpdates.sale_price = updates.preco_venda;
      if ('sale_price' in updates) dbUpdates.sale_price = updates.sale_price;
      if ('preco_custo' in updates) dbUpdates.cost_price = updates.preco_custo;
      if ('cost_price' in updates) dbUpdates.cost_price = updates.cost_price;
      if ('preco_troca' in updates) dbUpdates.exchange_price = updates.preco_troca;
      if ('exchange_price' in updates) dbUpdates.exchange_price = updates.exchange_price;
      if ('preco_completa' in updates) dbUpdates.full_price = updates.preco_completa;
      if ('full_price' in updates) dbUpdates.full_price = updates.full_price;
      if ('ativo' in updates) dbUpdates.is_active = updates.ativo;
      if ('is_active' in updates) dbUpdates.is_active = updates.is_active;
      if ('depositoId' in updates) dbUpdates.deposit_id = updates.depositoId;
      if ('deposit_id' in updates) dbUpdates.deposit_id = updates.deposit_id;
      if ('movement_type' in updates) dbUpdates.movement_type = updates.movement_type;
      if ('return_product_id' in updates) dbUpdates.return_product_id = updates.return_product_id;
      if ('track_stock' in updates) dbUpdates.track_stock = updates.track_stock;
      if ('product_group' in updates) dbUpdates.product_group = updates.product_group;
      if ('image_url' in updates) dbUpdates.image_url = updates.image_url;
      
      const { error } = await supabase.from('products').update(dbUpdates).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
  },
  employees: { 
    toArray: async () => {
      const { data } = await supabase.from('employees').select('*');
      return data || [];
    },
    filter: () => ({ toArray: async () => [] }),
    put: async (employee: any) => {
      const { error } = await supabase.from('employees').upsert(employee);
      if (error) throw error;
    },
    update: async (id: string, updates: any) => {
      // Convert PT→EN antes de atualizar
      const dbUpdates: any = {};
      if ('nome' in updates) dbUpdates.name = updates.nome;
      if ('name' in updates) dbUpdates.name = updates.name;
      if ('cargo' in updates) dbUpdates.role = updates.cargo;
      if ('role' in updates) dbUpdates.role = updates.role;
      if ('depositoId' in updates) dbUpdates.deposit_id = updates.depositoId;
      if ('deposit_id' in updates) dbUpdates.deposit_id = updates.deposit_id;
      if ('ativo' in updates) dbUpdates.is_active = updates.ativo;
      if ('is_active' in updates) dbUpdates.is_active = updates.is_active;
      if ('username' in updates) dbUpdates.username = updates.username;
      if ('password' in updates) dbUpdates.password = updates.password;
      if ('permissoes' in updates) dbUpdates.permissions = updates.permissoes;
      if ('permissions' in updates) dbUpdates.permissions = updates.permissions;
      
      const { error } = await supabase.from('employees').update(dbUpdates).eq('id', id);
      if (error) throw error;
    },
  },
  clients: { 
    toArray: async () => {
      const { data } = await supabase.from('clients').select('*');
      return data || [];
    },
    add: async (client: any) => {
      const { error } = await supabase.from('clients').insert(client);
      if (error) throw error;
    },
  },
  service_orders: { 
    toArray: async () => {
      const { data } = await supabase.from('service_orders').select('*');
      return data || [];
    },
    get: async (id: string) => {
      const { data } = await supabase.from('service_orders').select('*').eq('id', id).single();
      return data;
    },
    put: async (order: any) => {
      const { error } = await supabase.from('service_orders').upsert(order);
      if (error) throw error;
    },
    update: async (id: string, updates: any) => {
      // Convert PT→EN antes de atualizar
      const dbUpdates: any = {};
      if ('numeroOs' in updates) dbUpdates.order_number = updates.numeroOs;
      if ('order_number' in updates) dbUpdates.order_number = updates.order_number;
      if ('depositoId' in updates) dbUpdates.deposit_id = updates.depositoId;
      if ('deposit_id' in updates) dbUpdates.deposit_id = updates.deposit_id;
      if ('clienteId' in updates) dbUpdates.client_id = updates.clienteId;
      if ('client_id' in updates) dbUpdates.client_id = updates.client_id;
      if ('clienteNome' in updates) dbUpdates.client_name = updates.clienteNome;
      if ('client_name' in updates) dbUpdates.client_name = updates.client_name;
      if ('clienteTelefone' in updates) dbUpdates.client_phone = updates.clienteTelefone;
      if ('client_phone' in updates) dbUpdates.client_phone = updates.client_phone;
      if ('enderecoEntrega' in updates) dbUpdates.delivery_address = updates.enderecoEntrega;
      if ('delivery_address' in updates) dbUpdates.delivery_address = updates.delivery_address;
      if ('tipoAtendimento' in updates) dbUpdates.service_type = updates.tipoAtendimento;
      if ('service_type' in updates) dbUpdates.service_type = updates.service_type;
      if ('status' in updates) dbUpdates.status = updates.status;
      if ('statusEntrega' in updates) dbUpdates.delivery_status = updates.statusEntrega;
      if ('delivery_status' in updates) dbUpdates.delivery_status = updates.delivery_status;
      if ('total' in updates) dbUpdates.total = updates.total;
      if ('delivery_fee' in updates) dbUpdates.delivery_fee = updates.delivery_fee;
      if ('historico' in updates) dbUpdates.history = updates.historico;
      if ('history' in updates) dbUpdates.history = updates.history;
      
      const { error } = await supabase.from('service_orders').update(dbUpdates).eq('id', id);
      if (error) throw error;
    },
    where: (field: string) => ({
      equals: (value: any) => ({
        count: async () => {
          const { count } = await supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq(field, value);
          return count || 0;
        },
      }),
    }),
  },
  service_order_items: {
    bulkPut: async (items: any[]) => {
      const { error } = await supabase.from('service_order_items').upsert(items);
      if (error) throw error;
    },
  },
  payment_methods: { 
    toArray: async () => {
      const { data } = await supabase.from('payment_methods').select('*');
      return data || [];
    },
    filter: () => ({ toArray: async () => [] }),
  },
  delivery_zones: { 
    toArray: async () => {
      const { data } = await supabase.from('delivery_zones').select('*');
      return data || [];
    },
    bulkDelete: async () => {},
    put: async (zone: any) => {
      const { error } = await supabase.from('delivery_zones').upsert(zone);
      if (error) throw error;
    },
  },
  zone_pricing: { 
    toArray: async () => {
      const { data } = await supabase.from('zone_pricing').select('*');
      return data || [];
    },
    bulkDelete: async () => {},
    put: async (pricing: any) => {
      const { error } = await supabase.from('zone_pricing').upsert(pricing);
      if (error) throw error;
    },
  },
  delivery_sectors: {
    bulkDelete: async () => {},
  },
  stock_movements: { 
    toArray: async () => {
      const { data } = await supabase.from('stock_movements').select('*');
      return data || [];
    },
    put: async (movement: any) => {
      const { error } = await supabase.from('stock_movements').insert(movement);
      if (error) throw error;
    },
    bulkAdd: async (movements: any[]) => {
      const { error } = await supabase.from('stock_movements').insert(movements);
      if (error) throw error;
    },
    where: (field: string) => ({
      equals: (value: any) => ({
        count: async () => {
          const { count } = await supabase.from('stock_movements').select('*', { count: 'exact', head: true }).eq(field, value);
          return count || 0;
        },
        delete: async () => {
          const { error } = await supabase.from('stock_movements').delete().eq(field, value);
          if (error) throw error;
        },
      }),
    }),
  },
  stock_balance: { 
    toArray: async () => {
      // Calcula saldo on-the-fly a partir de stock_movements (fonte da verdade)
      const { data, error } = await supabase.from('stock_movements').select('deposit_id, product_id, quantity, type');
      if (error) throw error;

      const ENTRY_TYPES = ['IN', 'ENTRY', 'CARGA_INICIAL', 'TRADE_IN', 'AJUSTE_POSITIVO'];
      const EXIT_TYPES = ['OUT', 'SALE', 'LOSS', 'TRANSFER_OUT', 'AJUSTE_NEGATIVO'];
      const map = new Map<string, { deposit_id: string; product_id: string; quantidade_atual: number }>();

      (data || []).forEach((mov: any) => {
        const key = `${mov.deposit_id}__${mov.product_id}`;
        const qty = Number(mov.quantity || 0);
        const t = (mov as any).type as string | null;
        const isEntry = t ? ENTRY_TYPES.includes(t) : qty >= 0;
        const isExit = t ? EXIT_TYPES.includes(t) : qty < 0;
        const signed = isExit ? -Math.abs(qty) : Math.abs(qty);
        const current = map.get(key)?.quantidade_atual || 0;
        map.set(key, {
          deposit_id: mov.deposit_id,
          product_id: mov.product_id,
          quantidade_atual: current + (isEntry ? Math.abs(qty) : signed),
        });
      });

      return Array.from(map.values()).map((row, idx) => ({ id: `${idx}`, ...row }));
    },
    filter: (predicate?: (sb: any) => boolean) => ({
      toArray: async () => {
        const all = await db.stock_balance.toArray();
        return typeof predicate === 'function' ? all.filter(predicate) : all;
      },
    }),
    put: async (balance: any) => {
      // Mantém compatibilidade (no-op real) mas aceita chamadas existentes
      const { error } = await supabase.from('stock_balance').upsert(balance);
      if (error) throw error;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('stock_balance').delete().eq('id', id);
      if (error) throw error;
    },
    where: (field: string) => ({
      equals: (value: any) => ({
        delete: async () => {
          const { error } = await supabase.from('stock_balance').delete().eq(field, value);
          if (error) throw error;
        },
      }),
    }),
  },
  product_pricing: {
    toArray: async () => {
      const { data } = await supabase.from('product_pricing').select('*');
      return data || [];
    },
    filter: () => ({ toArray: async () => [] }),
    delete: async (id: string) => {
      const { error } = await supabase.from('product_pricing').delete().eq('id', id);
      if (error) throw error;
    },
    where: (field: string) => ({
      delete: async () => {
        const { error } = await supabase.from('product_pricing').delete().eq(field, field);
        if (error) throw error;
      },
    }),
  },
  accounts_receivable: {
    toArray: async () => {
      const { data } = await supabase.from('accounts_receivable').select('*');
      return data || [];
    },
  },
  receivable_payments: {
    where: (field: string) => ({
      equals: (value: any) => ({
        toArray: async () => {
          const { data } = await supabase.from('receivable_payments').select('*').eq(field, value);
          return data || [];
        },
      }),
    }),
  },
  receivables: {},
  cash_flow_entries: {
    where: (field: string) => ({
      equals: (value: any) => ({
        toArray: async () => {
          const { data } = await supabase.from('cash_flow_entries').select('*').eq(field, value);
          return data || [];
        },
        count: async () => {
          const { count } = await supabase.from('cash_flow_entries').select('*', { count: 'exact', head: true }).eq(field, value);
          return count || 0;
        },
      }),
    }),
  },
  outbox_events: {
    put: async () => {}, // Não usado em v3.0
  },
  transaction: async (mode: any, tables: any, fn: any) => {
    // Stub simples - sem transação real
    await fn();
  },
};

// ==================== DEPOSITS ====================

export const listDeposits = async () => {
  const { data, error } = await supabase.from('deposits').select('*').eq('active', true);
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id,
    nome: d.name,
    endereco: d.address,
    ativo: d.active,
    cor: d.color,
    require_stock_audit: d.require_stock_audit,
    free_shipping_min_value: d.free_shipping_min_value,
  }));
};

export const upsertDeposit = async (deposit: any) => {
  const dbDeposit: any = {
    id: deposit.id,
    name: deposit.nome,
    address: deposit.endereco,
    active: deposit.ativo ?? true,
    color: deposit.cor,
    require_stock_audit: deposit.require_stock_audit ?? false,
    free_shipping_min_value: deposit.free_shipping_min_value ?? null,
  };
  const { error } = await supabase.from('deposits').upsert(dbDeposit);
  if (error) throw error;
};

export const deleteDeposit = async (id: string) => {
  const { error } = await supabase.from('deposits').delete().eq('id', id);
  if (error) throw error;
};

// ==================== PRODUCTS ====================

export const listProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').eq('is_active', true);
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    codigo: p.code || p.codigo || 'Sem código',
    nome: p.name || p.nome || 'Sem nome',
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
  }));
};

export const getProducts = listProducts;

// ==================== SALES MODALITIES (LEGACY KV) ====================

const SAFE_KV_FETCH = async (key: string, fallback: any) => {
  try {
    const { data, error, status } = await supabase.from('kv').select('*').eq('key', key).single();
    if (error) {
      const acceptable = error.code === 'PGRST116' || status === 406 || status === 404;
      if (!acceptable) throw error;
      return fallback;
    }
    return (data?.value as any) ?? fallback;
  } catch (err) {
    console.warn(`KV fetch fallback for ${key}:`, err);
    return fallback;
  }
};

const SAFE_KV_SAVE = async (key: string, value: any) => {
  const { error } = await supabase.from('kv').upsert({ key, value });
  if (error) throw error;
};

export const getSalesModalities = async () => {
  return SAFE_KV_FETCH('sales_modalities', [] as any[]);
};

export const saveSalesModalities = async (items: any[]) => {
  return SAFE_KV_SAVE('sales_modalities', items || []);
};

export const getModalityLabels = async () => {
  return SAFE_KV_FETCH('modality_labels', [] as any[]);
};

export const saveModalityLabels = async (items: any[]) => {
  return SAFE_KV_SAVE('modality_labels', items || []);
};

export const getStockRules = async () => {
  return SAFE_KV_FETCH('stock_rules', [] as any[]);
};

export const saveStockRules = async (items: any[]) => {
  return SAFE_KV_SAVE('stock_rules', items || []);
};

export const listEmployees = async () => {
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
    telefone: e.phone,
    cpf: e.cpf,
  }));
};

// ==================== SERVICE ORDERS ====================

export const getOrders = async () => {
  const { data, error } = await supabase.from('service_orders').select('*');
  if (error) throw error;
  return (data || []).map((o: any) => ({
    id: o.id,
    numeroOs: o.order_number,
    depositoId: o.deposit_id,
    clienteId: o.client_id,
    clienteNome: o.client_name,
    clienteTelefone: o.client_phone,
    enderecoEntrega: o.delivery_address,
    tipoAtendimento: o.service_type,
    status: o.status,
    statusEntrega: o.delivery_status,
    total: o.total,
    delivery_fee: o.delivery_fee,
    dataHoraCriacao: new Date(o.created_at).getTime(),
    dataHoraConclusao: o.completed_at ? new Date(o.completed_at).getTime() : undefined,
  }));
};

  export const listServiceOrders = getOrders;

// ==================== DELIVERY ====================

export const listDeliveryJobs = async () => {
  const { data, error } = await supabase.from('delivery_jobs').select('*');
  if (error) throw error;
  return data || [];
};

export const getAllDriversStatus = async () => {
  const { data, error } = await supabase.from('driver_presence').select('*');
  if (error) throw error;
  return data || [];
};

export const startRoute = async (jobId: string) => {
  const { error } = await supabase
    .from('delivery_jobs')
    .update({ status: 'EM_ROTA', started_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
};

export const completeJob = async (jobId: string) => {
  const { error } = await supabase
    .from('delivery_jobs')
    .update({ status: 'CONCLUIDA', completed_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
};

export const returnJob = async (jobId: string) => {
  const { error } = await supabase
    .from('delivery_jobs')
    .update({ status: 'DEVOLVIDA' })
    .eq('id', jobId);
  if (error) throw error;
};

export const cancelJob = async (jobId: string) => {
  const { error } = await supabase
    .from('delivery_jobs')
    .update({ status: 'CANCELADA' })
    .eq('id', jobId);
  if (error) throw error;
};

export const upsertDeliveryZone = async (zone: any) => {
  const dbZone: any = {
    id: zone.id,
    name: zone.name,
    color: zone.color,
    map_polygon: zone.map_polygon,
  };
  const { error } = await supabase.from('delivery_zones').upsert(dbZone);
  if (error) throw error;
};

export const deleteDeliveryZone = async (id: string) => {
  const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
  if (error) throw error;
};

export const upsertZonePricing = async (pricing: any) => {
  const dbPricing: any = {
    id: pricing.id,
    zone_id: pricing.zone_id || pricing.zoneId,
    deposit_id: pricing.deposit_id || pricing.depositoId,
    fee: pricing.fee || pricing.taxa,
  };
  const { error } = await supabase.from('zone_pricing').upsert(dbPricing);
  if (error) throw error;
};

export const upsertDeliverySector = async (sector: any) => {
  const dbSector: any = {
    id: sector.id,
    zone_id: sector.zone_id || sector.zoneId,
    name: sector.name || sector.nome,
    map_polygon: sector.map_polygon,
  };
  const { error } = await supabase.from('delivery_sectors').upsert(dbSector);
  if (error) throw error;
};

export const moveDeliverySector = async (sectorId: string, newZoneId: string) => {
  const { error } = await supabase
    .from('delivery_sectors')
    .update({ zone_id: newZoneId })
    .eq('id', sectorId);
  if (error) throw error;
};

export const deleteDeliverySector = async (id: string) => {
  const { error } = await supabase.from('delivery_sectors').delete().eq('id', id);
  if (error) throw error;
};

export const getDriverLocations = async () => {
  const { data, error } = await supabase.from('driver_presence').select('*');
  if (error) throw error;
  return data || [];
};

// ==================== STOCK ====================

export const applyMovement = async (movement: any) => {
  const rawType = (movement.type || movement.tipo || '').toString().toUpperCase();
  const rawQuantity = Number(movement.quantity ?? movement.quantidade ?? 0);

  const ENTRY_TYPES = ['IN', 'ENTRY', 'ENTRADA', 'CARGA_INICIAL', 'AJUSTE_POSITIVO', 'TRANSFER_IN', 'TRADE_IN', 'PURCHASE'];
  const EXIT_TYPES = ['OUT', 'SAIDA', 'SALE', 'TRANSFER_OUT', 'LOSS', 'AJUSTE_NEGATIVO', 'CONSUMO'];

  const isExit = EXIT_TYPES.includes(rawType);
  const isEntry = ENTRY_TYPES.includes(rawType) || (!isExit && rawQuantity >= 0);
  const signedQuantity = isExit ? -Math.abs(rawQuantity) : Math.abs(rawQuantity);
  const normalizedType = isExit ? 'OUT' : 'IN';

  const dbMovement: any = {
    id: movement.id || crypto.randomUUID(),
    product_id: movement.productId || movement.produtoId,
    deposit_id: movement.depositId || movement.depositoId,
    quantity: signedQuantity,
    type: normalizedType,
    origin: movement.origin || movement.origem || rawType || movement.motivo,
    reason: movement.reason || movement.motivo,
    reference_id: movement.reference_id || movement.referenciaId,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('stock_movements').insert(dbMovement);
  if (error) throw error;
};

// ==================== ALERTS ====================

export const DEFAULT_ALERTS_CONFIG = {
  minStock: {},
  financialDaysNotice: 3,
  minMarginPercent: 15,
  enabledStock: true,
  enabledFinancial: true,
  enabledMargin: true,
};

export const scanSystemForAlerts = async (produtos: any[]) => {
  // TODO: Implementar lógica de alertas
  return [];
};

export const getAlertsConfig = async () => {
  try {
    const { data, error, status } = await supabase
      .from('kv')
      .select('*')
      .eq('key', 'alerts_config')
      .single();

    if (error) {
      const acceptable = error.code === 'PGRST116' || status === 406 || status === 404;
      if (!acceptable) throw error;
      console.warn('alerts_config não disponível, usando padrão:', error.message);
      return DEFAULT_ALERTS_CONFIG;
    }

    return (data?.value as any) || DEFAULT_ALERTS_CONFIG;
  } catch (err) {
    console.warn('Falha ao obter alerts_config, aplicando padrão:', err);
    return DEFAULT_ALERTS_CONFIG;
  }
};

export const saveAlertsConfig = async (config: any) => {
  const payload = config || DEFAULT_ALERTS_CONFIG;
  const { error } = await supabase.from('kv').upsert({
    key: 'alerts_config',
    value: payload,
  });
  if (error) throw error;
};

// ==================== AUDIT ====================

export const normalizeDepositId = (id: any) => {
  if (!id) return null;
  return String(id);
};

// ==================== CONTROL PANEL ====================

export const performFactoryReset = async () => {
  // ⚠️ PERIGOSO: Esta função limpa TODOS os dados
  const confirmed = window.confirm(
    'ATENÇÃO: Isso irá apagar TODOS os dados do sistema!\n\n' +
    'Esta ação é IRREVERSÍVEL.\n\n' +
    'Você tem certeza absoluta?'
  );
  
  if (!confirmed) return;
  
  const doubleConfirm = window.prompt('Digite "APAGAR TUDO" para confirmar:');
  if (doubleConfirm !== 'APAGAR TUDO') {
    alert('Operação cancelada.');
    return;
  }
  
  // Limpa todas as tabelas principais
  const tables = [
    'service_orders',
    'service_order_items',
    'service_order_payments',
    'stock_movements',
    'clients',
    'products',
    'delivery_jobs',
  ];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.error(`Erro ao limpar ${table}:`, error);
  }
  
  alert('Sistema resetado. Recarregue a página.');
  window.location.reload();
};

// ==================== PAYMENT METHODS HELPERS ====================

import { paymentMethodService } from '@/services';

/**
 * Lista todas as formas de pagamento
 */
export async function listPaymentMethods() {
  return await paymentMethodService.getAll();
}

/**
 * Delete uma forma de pagamento
 */
export async function deletePaymentMethod(id: string) {
  return await paymentMethodService.delete(id);
}

/**
 * Lista máquinas (stub - será implementado depois)
 */
export async function listMachines() {
  // TODO: Implementar serviço de máquinas
  return [];
}

/**
 * Atualiza/cria máquina (stub - será implementado depois)
 */
export async function upsertMachine(machine: any) {
  // TODO: Implementar serviço de máquinas
  console.warn('upsertMachine não implementado ainda');
}

/**
 * Registra auditoria (stub - será implementado depois)
 */
export async function recordAudit(audit: any) {
  // TODO: Implementar serviço de auditoria
  console.log('Auditoria:', audit);
}

/**
 * Lista depósitos
 */
export async function listDeposits() {
  const { data } = await supabase.from('deposits').select('*').eq('active', true);
  return data || [];
}
