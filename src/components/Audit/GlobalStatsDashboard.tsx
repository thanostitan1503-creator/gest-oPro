import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Zap, Store, Monitor, Crown, Heart, Package } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/domain/supabaseClient';
import { db } from '@/domain/db';
import type { AuditDashboardStats } from '../../types/audit';

const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === '--') return 0;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toName = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  const str = String(value).trim();
  return str ? str : '-';
};

const normalizeStats = (payload: any): AuditDashboardStats => {
  const topProduct =
    payload?.top_product_sold ??
    payload?.top_product ??
    payload?.top_sold_product ??
    payload?.top_product_by_qty ??
    {};

  return {
    top_driver: {
      name: toName(payload?.top_driver?.name),
      count: toNumber(payload?.top_driver?.count ?? payload?.top_driver?.deliveries),
    },
    fastest_driver: {
      name: toName(payload?.fastest_driver?.name),
      avg_minutes: toNumber(payload?.fastest_driver?.avg_minutes ?? payload?.fastest_driver?.avg_min ?? payload?.fastest_driver?.avg_time),
    },
    top_deposit: {
      name: toName(payload?.top_deposit?.name),
      total: toNumber(payload?.top_deposit?.total ?? payload?.top_deposit?.value),
    },
    top_cashier: {
      name: toName(payload?.top_cashier?.name),
      count: toNumber(payload?.top_cashier?.count ?? payload?.top_cashier?.orders),
    },
    top_client_value: {
      name: toName(payload?.top_client_value?.name),
      total: toNumber(payload?.top_client_value?.total ?? payload?.top_client_value?.value),
    },
    top_client_orders: {
      name: toName(payload?.top_client_orders?.name),
      count: toNumber(payload?.top_client_orders?.count ?? payload?.top_client_orders?.orders),
    },
    top_product_sold: {
      name: toName(topProduct?.name ?? topProduct?.product_name ?? topProduct?.produto_nome),
      count: toNumber(topProduct?.count ?? topProduct?.qty ?? topProduct?.quantity ?? topProduct?.total),
    },
  };
};

const emptyStats: AuditDashboardStats = {
  top_driver: { name: '-', count: 0 },
  fastest_driver: { name: '-', avg_minutes: 0 },
  top_deposit: { name: '-', total: 0 },
  top_cashier: { name: '-', count: 0 },
  top_client_value: { name: '-', total: 0 },
  top_client_orders: { name: '-', count: 0 },
  top_product_sold: { name: '-', count: 0 },
};

export const GlobalStatsDashboard: React.FC = () => {
  const [stats, setStats] = useState<AuditDashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const deposits = useLiveQuery(() => db.deposits.toArray(), []);
  const depositOptions = useMemo(() => {
    const items = (deposits || []).filter((d) => d.ativo !== false);
    return items.sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? '')));
  }, [deposits]);

  useEffect(() => {
    let alive = true;
    const loadStats = async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_audit_dashboard_stats', {
          target_deposit_id: selectedDepositId,
        });
        if (rpcError) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('AUDIT_DASHBOARD_RPC_ERROR', rpcError);
          }
          if (!alive) return;
          setStats(emptyStats);
          return;
        }
        const raw = Array.isArray(data) ? data[0] : data;
        let parsed: any = raw;
        if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = {};
          }
        }
        const normalized = normalizeStats(parsed || {});
        if (!alive) return;
        setStats(normalized);
      } catch (err: any) {
        if (!alive) return;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('AUDIT_DASHBOARD_LOAD_FAIL', err);
        }
        setStats(emptyStats);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void loadStats();
    return () => {
      alive = false;
    };
  }, [selectedDepositId]);

  const cards = useMemo(() => {
    const formatCount = (count: number, label: string) => (count > 0 ? `${count} ${label}` : '--');
    const formatMinutes = (minutes: number) => (minutes > 0 ? `${minutes} min medio` : '--');
    const formatCurrencyOrDash = (value: number) => (value > 0 ? formatCurrency(value) : '--');
    const isEmptyName = (name: string) => !name || name === '-' || name === '--';

    return [
      {
        key: 'top_driver',
        title: 'Entregador + Produtivo',
        icon: Bike,
        name: stats.top_driver.name,
        value: formatCount(stats.top_driver.count, 'entregas'),
        isEmpty: isEmptyName(stats.top_driver.name) || stats.top_driver.count === 0,
      },
      {
        key: 'fastest_driver',
        title: 'The Flash (Mais Rapido)',
        icon: Zap,
        name: stats.fastest_driver.name,
        value: formatMinutes(stats.fastest_driver.avg_minutes),
        isEmpty: isEmptyName(stats.fastest_driver.name) || stats.fastest_driver.avg_minutes === 0,
      },
      {
        key: 'top_deposit',
        title: 'Deposito Lider',
        icon: Store,
        name: stats.top_deposit.name,
        value: formatCurrencyOrDash(stats.top_deposit.total),
        isEmpty: isEmptyName(stats.top_deposit.name) || stats.top_deposit.total === 0,
      },
      {
        key: 'top_cashier',
        title: 'Caixa Mais Ativo',
        icon: Monitor,
        name: stats.top_cashier.name,
        value: formatCount(stats.top_cashier.count, 'ordens'),
        isEmpty: isEmptyName(stats.top_cashier.name) || stats.top_cashier.count === 0,
      },
      {
        key: 'top_client_value',
        title: 'Cliente VIP (Valor)',
        icon: Crown,
        name: stats.top_client_value.name,
        value: formatCurrencyOrDash(stats.top_client_value.total),
        isEmpty: isEmptyName(stats.top_client_value.name) || stats.top_client_value.total === 0,
      },
      {
        key: 'top_client_orders',
        title: 'Cliente Fiel (Pedidos)',
        icon: Heart,
        name: stats.top_client_orders.name,
        value: formatCount(stats.top_client_orders.count, 'pedidos'),
        isEmpty: isEmptyName(stats.top_client_orders.name) || stats.top_client_orders.count === 0,
      },
      {
        key: 'top_product_sold',
        title: 'Produto + Vendido',
        icon: Package,
        name: stats.top_product_sold.name,
        value: formatCount(stats.top_product_sold.count, 'un'),
        isEmpty: isEmptyName(stats.top_product_sold.name) || stats.top_product_sold.count === 0,
      },
    ];
  }, [stats]);

  return (
    <div className="bg-surface rounded-2xl border border-bdr p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-black text-txt-muted uppercase tracking-widest">Visao Geral</p>
          <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">Campeoes Globais</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-txt-muted uppercase">Filtro</span>
          <select
            value={selectedDepositId ?? ''}
            onChange={(e) => setSelectedDepositId(e.target.value || null)}
            className="bg-app border border-bdr rounded-lg px-2 py-1 text-xs font-bold text-txt-main focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">Visao Global</option>
            {depositOptions.length > 0 && (
              <optgroup label="Filtrar por Deposito">
                {depositOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: cards.length }).map((_, idx) => (
              <div key={idx} className="bg-app border border-bdr rounded-xl p-4 animate-pulse">
                <div className="h-4 w-24 bg-bdr/50 rounded mb-3" />
                <div className="h-5 w-40 bg-bdr/50 rounded mb-2" />
                <div className="h-4 w-20 bg-bdr/50 rounded" />
              </div>
            ))
          : cards.map((card) => {
              const Icon = card.icon;
              const cardTone = card.isEmpty ? 'opacity-60' : '';
              const iconTone = card.isEmpty ? 'text-orange-500/50' : 'text-orange-500';
              return (
                <div key={card.key} className={`bg-app border border-bdr rounded-xl p-4 flex items-start justify-between ${cardTone}`}>
                  <div>
                    <p className="text-[10px] uppercase font-black text-txt-muted">{card.title}</p>
                    <p className="text-sm font-black text-txt-main mt-2">{card.name || '--'}</p>
                    {card.isEmpty ? (
                      <p className="text-xs text-txt-muted">Sem dados suficientes</p>
                    ) : (
                      <p className="text-xs text-txt-muted">{card.value}</p>
                    )}
                  </div>
                  <div className="bg-surface border border-bdr rounded-lg p-2">
                    <Icon className={`w-5 h-5 ${iconTone}`} />
                  </div>
                </div>
              );
            })}
      </div>
      <p className="text-[10px] text-txt-muted mt-4">
        *Metricas baseadas apenas em vendas finalizadas.
      </p>
    </div>
  );
};
