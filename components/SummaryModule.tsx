import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Calendar, 
  TrendingUp, 
  Package, 
  Users, 
  Truck, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Activity
} from 'lucide-react';
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
import { OrdemServico, LogHistoricoOS } from '@/domain/types';
import { listServiceOrders, listDeposits, listEmployees, normalizeDepositId } from '@/utils/legacyHelpers';
// ⚠️ REMOVIDO v3.0: import { normalizeDepositId } from '@/domain/utils/dataSanitizer';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

interface SummaryModuleProps {
  onClose: () => void;
}

const KPICard = ({ label, value, trend, trendValue, icon: Icon, color }: any) => (
  <div className="bg-surface p-5 rounded-xl shadow-sm border border-bdr relative overflow-hidden group transition-colors duration-300">
    <div className={`absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
      <Icon className="w-16 h-16" />
    </div>
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')} ${color} bg-opacity-10`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-txt-muted text-sm font-medium">{label}</span>
    </div>
    <div className="text-2xl font-bold text-txt-main mb-1">{value}</div>
    {trend && (
      <div className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
        {trendValue} vs. ontem
      </div>
    )}
  </div>
);

export const SummaryModule: React.FC<SummaryModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'deposito' | 'vendedor' | 'entregador' | 'logs'>('deposito');
  const [orders, setOrders] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const parseDate = (value: string) => new Date(`${value}T00:00:00`).getTime();
  const parseMs = (value: any) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    }
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const normalizeOrder = (row: any) => {
    const historico = row.historico_json ?? row.historico ?? row.history ?? [];
    const createdAtMs = parseMs(
      row.data_hora_criacao ??
      row.dataHoraCriacao ??
      row.created_at_ms ??
      row.created_at ??
      row.createdAt ??
      0
    );
    const concludedAtMs = parseMs(
      row.data_hora_conclusao ??
      row.dataHoraConclusao ??
      row.completed_at ??
      row.completedAt ??
      0
    );
    const normalized = normalizeDepositId(row);
    return {
      id: String(row.id ?? ''),
      numeroOs: String(
        row.numero_os ??
        row.numeroOs ??
        row.order_number ??
        row.orderNumber ??
        row.number ??
        row.id ??
        ''
      ),
      depositoId: normalized.depositoId,
      clienteId:
        row.cliente_id ??
        row.clienteId ??
        row.client_id ??
        row.clientId ??
        null,
      clienteNome:
        row.cliente_nome ??
        row.clienteNome ??
        row.client_name ??
        row.clientName ??
        '',
      entregadorId:
        row.entregador_id ??
        row.entregadorId ??
        row.driver_id ??
        row.driverId ??
        null,
      status: row.status ?? row.order_status ?? 'PENDENTE',
      statusEntrega: row.status_entrega ?? row.statusEntrega ?? row.delivery_status ?? null,
      tipoAtendimento:
        row.tipo_atendimento ??
        row.tipoAtendimento ??
        row.service_type ??
        'BALCAO',
      total: Number(row.total ?? row.total_amount ?? row.amount ?? 0) || 0,
      historico: Array.isArray(historico) ? historico : [],
      createdAtMs,
      concludedAtMs,
    };
  };

  useEffect(() => {
    const fetchSummaryData = async () => {
      setLoading(true);
      try {
        const [allOrders, allDeposits, allEmployees] = await Promise.all([
          listServiceOrders(),
          listDeposits(),
          listEmployees()
        ]);

        const startMs = parseDate(startDate);
        const endMs = parseDate(endDate) + (24 * 60 * 60 * 1000) - 1; // End of the day

        const normalizedOrders = allOrders.map(normalizeOrder);

        const filteredOrders = normalizedOrders.filter(o => 
          o.createdAtMs >= startMs && o.createdAtMs <= endMs
        );

        setOrders(filteredOrders);
        setDeposits(allDeposits);
        setEmployees(allEmployees);
      } catch (error: any) {
        console.error('Erro ao buscar dados do resumo:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryData();
  }, [startDate, endDate]);

  const derived = useMemo(() => {
    const depositNameMap = new Map<string, string>();
    deposits.forEach((d: any) => {
      const name = d.nome ?? d.name ?? d.id ?? '';
      if (d.id) depositNameMap.set(String(d.id), String(name));
    });
    const employeeNameMap = new Map<string, string>();
    employees.forEach((e: any) => {
      const name = e.nome ?? e.name ?? e.username ?? e.id ?? '';
      if (e.id) employeeNameMap.set(String(e.id), String(name));
    });

    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const concluded = orders.filter((o) => o.status === 'CONCLUIDA').length;
    const uniqueClients = new Set(orders.map((o) => o.clienteId || o.clienteNome || '')).size;

    const delivered = orders.filter((o) => o.statusEntrega === 'CONCLUIDA').length;
    const deliveryRate = orders.length ? Math.round((delivered / orders.length) * 100) : 0;

    const byDeposit = orders.reduce<Record<string, {
      depositoId: string;
      depositoNome: string;
      count: number;
      deliveries: number;
      pickups: number;
      gross: number;
      discounts: number;
    }>>((acc, o) => {
      const normalized = normalizeDepositId(o);
      const key = normalized.depositoId || 'SEM_DEP';
      const name = depositNameMap.get(String(key)) || String(key);
      if (!acc[key]) {
        acc[key] = { depositoId: String(key), depositoNome: name, count: 0, deliveries: 0, pickups: 0, gross: 0, discounts: 0 };
      }
      acc[key].count += 1;
      acc[key].gross += o.total || 0;
      acc[key].deliveries += o.tipoAtendimento === 'DELIVERY' ? 1 : 0;
      acc[key].pickups += o.tipoAtendimento === 'BALCAO' ? 1 : 0;
      return acc;
    }, {});

    const extractSeller = (o: any) => {
      const logs = Array.isArray(o.historico) ? o.historico : [];
      const createdLog = logs.find((l: any) => String(l.acao ?? l.action ?? '').toLowerCase().includes('cri'));
      const raw = createdLog?.usuario ?? createdLog?.user ?? createdLog?.username ?? createdLog?.usuarioNome ?? null;
      return raw || 'Sistema';
    };

    const bySeller = orders.reduce<Record<string, { name: string; count: number; gross: number }>>((acc, o) => {
      const sellerName = extractSeller(o);
      if (!acc[sellerName]) {
        acc[sellerName] = { name: sellerName, count: 0, gross: 0 };
      }
      acc[sellerName].count += 1;
      acc[sellerName].gross += o.total || 0;
      return acc;
    }, {});

    const byDriver = orders.reduce<Record<string, { id: string; name: string; count: number; gross: number }>>((acc, o) => {
      const driverId = o.entregadorId ? String(o.entregadorId) : '';
      if (!driverId) return acc;
      const name = employeeNameMap.get(driverId) || driverId;
      if (!acc[driverId]) {
        acc[driverId] = { id: driverId, name, count: 0, gross: 0 };
      }
      acc[driverId].count += 1;
      acc[driverId].gross += o.total || 0;
      return acc;
    }, {});

    const consolidated = Object.values(byDeposit).reduce(
      (acc, dep) => {
        acc.count += dep.count;
        acc.deliveries += dep.deliveries;
        acc.pickups += dep.pickups;
        acc.gross += dep.gross;
        acc.discounts += dep.discounts;
        return acc;
      },
      { count: 0, deliveries: 0, pickups: 0, gross: 0, discounts: 0 }
    );

    return {
      totalSales,
      concluded,
      uniqueClients,
      deliveryRate,
      byDeposit: Object.values(byDeposit),
      bySeller: Object.values(bySeller),
      byDriver: Object.values(byDriver),
      consolidated,
    };
  }, [orders, deposits, employees]);

  const recentLogs = useMemo(() => {
    const allLogs: { osNum: string, log: LogHistoricoOS }[] = [];
    orders.forEach(o => {
      if (o.historico) {
        o.historico.forEach(h => {
          allLogs.push({ osNum: o.numeroOs, log: h });
        });
      }
    });
    const parseLogTime = (value: any) => {
      if (typeof value === 'number') return value;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    allLogs.sort((a, b) => parseLogTime(b.log.data) - parseLogTime(a.log.data));
    return allLogs.slice(0, 50);
  }, [orders]);

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-colors">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm shrink-0 gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-md shadow-indigo-500/20">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-txt-main tracking-tight">Resumo Gerencial</h2>
            <p className="text-sm text-txt-muted">Visão geral de desempenho e estoque</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* Seletor de Datas */}
          <div className="flex items-center bg-app border border-bdr rounded-xl p-1 shadow-sm w-full sm:w-auto transition-colors">
             <div className="flex items-center gap-2 px-3 border-r border-bdr">
               <Calendar className="w-4 h-4 text-txt-muted" />
               <input 
                type="date" 
                className="bg-transparent border-none text-xs font-bold text-txt-main focus:ring-0 p-0 w-28 appearance-none outline-none" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
               />
             </div>
             <div className="flex items-center gap-2 px-3">
               <span className="text-[10px] font-black text-txt-muted uppercase tracking-tighter">até</span>
               <input 
                type="date" 
                className="bg-transparent border-none text-xs font-bold text-txt-main focus:ring-0 p-0 w-28 appearance-none outline-none" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
               />
             </div>
             <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm ml-1">
               Atualizar
             </button>
          </div>

          <button 
            onClick={onClose}
            className="p-2 bg-app hover:bg-red-50 text-txt-muted hover:text-red-500 rounded-full transition-colors shrink-0 border border-bdr"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-app transition-colors">
        <div className="max-w-[1600px] mx-auto space-y-8">
          {loading && (
            <div className="text-xs font-bold text-txt-muted">Carregando dados do resumo...</div>
          )}
          {!loading && error && (
            <div className="text-xs font-bold text-red-500">Erro ao carregar resumo: {error}</div>
          )}

          {/* KPI Section */}
          <div>
            <h3 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-4 px-1">Indicadores do Período</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                label="Vendas Totais" 
                value={formatCurrency(derived.totalSales)} 
                trend={null}
                icon={DollarSign} 
                color="text-emerald-600" 
              />
              <KPICard 
                label="Pedidos Concluídos" 
                value={derived.concluded}
                trend={null}
                icon={Package} 
                color="text-blue-600" 
              />
              <KPICard 
                label="Novos Clientes" 
                value={derived.uniqueClients}
                trend={null}
                icon={Users} 
                color="text-violet-600" 
              />
              <KPICard 
                label="Entregas Realizadas" 
                value={`${derived.deliveryRate}%`} 
                trend={null}
                icon={Truck} 
                color="text-orange-500" 
              />
            </div>
          </div>

          {/* Detailed Breakdown Tabs */}
          <div className="bg-surface rounded-xl shadow-sm border border-bdr overflow-hidden transition-colors">
            <div className="border-b border-bdr px-6 pt-4 bg-app/30">
              <div className="flex gap-8">
                {[
                  { id: 'deposito', label: 'Por Depósito' },
                  { id: 'vendedor', label: 'Por Vendedor' },
                  { id: 'entregador', label: 'Por Entregador' },
                  { id: 'logs', label: 'Rastreio & Logs' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-4 text-sm font-bold transition-all relative ${
                      activeTab === tab.id 
                        ? 'text-indigo-600' 
                        : 'text-txt-muted hover:text-txt-main'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'logs' ? (
                <div className="space-y-4">
                   <h3 className="text-sm font-black text-txt-main uppercase flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-500" />
                      Últimas Atividades do Sistema
                   </h3>
                   <div className="border border-bdr rounded-xl overflow-hidden">
                      <table className="w-full text-sm text-left">
                         <thead className="bg-app text-xs font-bold text-txt-muted uppercase border-b border-bdr">
                            <tr>
                               <th className="px-6 py-3">Data / Hora</th>
                               <th className="px-6 py-3">O.S #</th>
                               <th className="px-6 py-3">Usuário</th>
                               <th className="px-6 py-3">Ação</th>
                               <th className="px-6 py-3">Detalhes</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-bdr">
                            {recentLogs.map((item, idx) => (
                               <tr key={idx} className="hover:bg-app transition-colors">
                                  <td className="px-6 py-3 font-mono text-xs text-txt-muted">{new Date(item.log.data).toLocaleString()}</td>
                                  <td className="px-6 py-3 font-bold text-indigo-600">{item.osNum}</td>
                                  <td className="px-6 py-3 font-medium text-txt-main">{item.log.usuario}</td>
                                  <td className="px-6 py-3">
                                     <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                        item.log.acao.includes('Edição') ? 'bg-amber-100 text-amber-700' :
                                        item.log.acao.includes('Criação') ? 'bg-green-100 text-green-700' :
                                        'bg-blue-100 text-blue-700'
                                     }`}>
                                        {item.log.acao}
                                     </span>
                                  </td>
                                  <td className="px-6 py-3 text-txt-muted italic">{item.log.detalhe}</td>
                               </tr>
                            ))}
                            {recentLogs.length === 0 && (
                               <tr><td colSpan={5} className="p-8 text-center text-txt-muted">Nenhum registro recente encontrado.</td></tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
              ) : activeTab === 'deposito' ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-app text-xs uppercase font-bold text-txt-muted border-b border-bdr">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Depósito</th>
                      <th className="px-4 py-3 text-center">Qtd. O.S</th>
                      <th className="px-4 py-3 text-center">Entregas</th>
                      <th className="px-4 py-3 text-center">Balcão</th>
                      <th className="px-4 py-3 text-right">Valor Bruto</th>
                      <th className="px-4 py-3 text-right">Descontos</th>
                      <th className="px-4 py-3 rounded-r-lg text-right">Valor Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {derived.byDeposit.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-txt-muted font-medium">Nenhum dado encontrado para o período.</td>
                      </tr>
                    )}
                    {derived.byDeposit.map((dep) => (
                      <tr key={dep.depositoId} className="hover:bg-app transition-colors">
                        <td className="px-4 py-4 font-bold text-txt-main">{dep.depositoNome}</td>
                        <td className="px-4 py-4 text-center font-medium text-txt-main">{dep.count}</td>
                        <td className="px-4 py-4 text-center font-medium text-txt-main">{dep.deliveries}</td>
                        <td className="px-4 py-4 text-center font-medium text-txt-main">{dep.pickups}</td>
                        <td className="px-4 py-4 text-right font-medium text-txt-main">{formatCurrency(dep.gross)}</td>
                        <td className="px-4 py-4 text-right text-red-500 font-bold">{dep.discounts ? `-${formatCurrency(dep.discounts)}` : formatCurrency(0)}</td>
                        <td className="px-4 py-4 font-black text-txt-main text-right">{formatCurrency(dep.gross - dep.discounts)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {derived.byDeposit.length > 0 && (
                    <tfoot className="border-t-2 border-bdr bg-app/50">
                      <tr className="font-black text-txt-main">
                        <td className="px-4 py-5 text-indigo-600 uppercase text-xs">Total Consolidado</td>
                        <td className="px-4 py-5 text-center">{derived.consolidated.count}</td>
                        <td className="px-4 py-5 text-center">{derived.consolidated.deliveries}</td>
                        <td className="px-4 py-5 text-center">{derived.consolidated.pickups}</td>
                        <td className="px-4 py-5 text-right text-txt-muted">{formatCurrency(derived.consolidated.gross)}</td>
                        <td className="px-4 py-5 text-right text-red-600">{derived.consolidated.discounts ? `-${formatCurrency(derived.consolidated.discounts)}` : formatCurrency(0)}</td>
                        <td className="px-4 py-5 text-indigo-600 text-lg text-right">{formatCurrency(derived.consolidated.gross - derived.consolidated.discounts)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : activeTab === 'vendedor' ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-app text-xs uppercase font-bold text-txt-muted border-b border-bdr">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Vendedor</th>
                      <th className="px-4 py-3 text-center">Qtd. O.S</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Valor Bruto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {derived.bySeller.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-txt-muted font-medium">Nenhum dado encontrado para o periodo.</td>
                      </tr>
                    )}
                    {derived.bySeller.map((seller) => (
                      <tr key={seller.name} className="hover:bg-app transition-colors">
                        <td className="px-4 py-4 font-bold text-txt-main">{seller.name}</td>
                        <td className="px-4 py-4 text-center font-medium text-txt-main">{seller.count}</td>
                        <td className="px-4 py-4 text-right font-medium text-txt-main">{formatCurrency(seller.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : activeTab === 'entregador' ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-app text-xs uppercase font-bold text-txt-muted border-b border-bdr">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Entregador</th>
                      <th className="px-4 py-3 text-center">Qtd. O.S</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Valor Bruto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {derived.byDriver.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-txt-muted font-medium">Nenhum dado encontrado para o periodo.</td>
                      </tr>
                    )}
                    {derived.byDriver.map((driver) => (
                      <tr key={driver.id} className="hover:bg-app transition-colors">
                        <td className="px-4 py-4 font-bold text-txt-main">{driver.name}</td>
                        <td className="px-4 py-4 text-center font-medium text-txt-main">{driver.count}</td>
                        <td className="px-4 py-4 text-right font-medium text-txt-main">{formatCurrency(driver.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-txt-muted bg-app/50 rounded-2xl border border-dashed border-bdr">
                  <div className="bg-surface p-6 rounded-full mb-4 shadow-sm border border-bdr">
                    <Search className="w-10 h-10 text-txt-muted" />
                  </div>
                  <p className="font-bold text-txt-muted">Nenhum dado encontrado</p>
                  <p className="text-xs mt-1">Selecione um filtro ou altere a data para visualizar os detalhes desta aba.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};


