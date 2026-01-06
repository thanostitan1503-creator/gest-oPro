
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Printer,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  AlertCircle,
  Plus,
  Minus,
  Target,
  Wallet,
  Trash2,
  Barcode,
  Truck
} from 'lucide-react';
import { NewExpenseModal } from '@/components/NewExpenseModal';
import { NewReceivableModal } from '@/components/NewReceivableModal';
import { GoalConfigModal } from '@/components/GoalConfigModal';
// ⚠️ REMOVIDO v3.0: useLiveQuery (use useState + useEffect + Services)
// ⚠️ REMOVIDO v3.0: db local (use Services: import { xxxService } from '@/services')
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
// ⚠️ REMOVIDO v3.0: // ⚠️ REMOVIDO v3.0 (use Services): import repositories
import { BoletoManagerModal } from '@/components/Financeiro/BoletoManagerModal';
import type { Boleto } from '@/types/boleto';
// ⚠️ REMOVIDO v3.0: import * as boletosRepo from '@/repositories/boletosRepo';
import { useShift } from '@/contexts/ShiftContext';
// ⚠️ REMOVIDO v3.0: import { normalizeDepositId } from '@/domain/utils/dataSanitizer';

interface FinancialModuleProps {
  onClose: () => void;
  onNavigate?: (module: string) => void;
}

type TabType = 'overview' | 'cashflow' | 'audit' | 'receivable' | 'payable';

export const FinancialModule: React.FC<FinancialModuleProps> = ({ onClose, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [isReceivableModalOpen, setReceivableModalOpen] = useState(false);
  const [receivableFilter, setReceivableFilter] = useState<'all' | 'personal' | 'with-client'>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentObs, setPaymentObs] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentDue, setInstallmentDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [isBoletoModalOpen, setBoletoModalOpen] = useState(false);
  const [selectedBoletoReceivableId, setSelectedBoletoReceivableId] = useState<string | null>(null);
  const [boletoCache, setBoletoCache] = useState<Record<string, Boleto | null>>({});
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const plus30 = new Date();
    plus30.setDate(plus30.getDate() + 30);
    return plus30.toISOString().slice(0, 10);
  });

  const financialSettings = useLiveQuery(() => db.financial_settings?.toCollection().first(), []);
  const receivables = useLiveQuery(() => db.accounts_receivable?.toArray(), []);
  const paymentMethods = useLiveQuery(() => db.payment_methods?.toArray(), []);
  const receivablePayments = useLiveQuery(() => (detailId ? db.receivable_payments?.where('receivable_id').equals(detailId).toArray() : []), [detailId]);
  const auditOrdersRaw = useLiveQuery(() => db.service_orders?.toArray(), []);
  const auditEmployeesRaw = useLiveQuery(() => db.employees?.toArray(), []);
  const auditDepositsRaw = useLiveQuery(() => db.deposits?.toArray(), []);
  const auditClientsRaw = useLiveQuery(() => db.clients?.toArray(), []);
  const { activeShift } = useShift();
  const cashFlowEntriesRaw = useLiveQuery(
    () => (activeShift?.id ? db.cash_flow_entries?.where('shift_id').equals(activeShift.id).toArray() : []),
    [activeShift?.id]
  );
  const stockMovementsRaw = useLiveQuery(() => db.stock_movements?.toArray(), []);


  // -- Config State --
  const [config, setConfig] = useState({
    monthlyGoal: 20000,
    minCashAlert: 500,
    showCents: true
  });

  const monthlyGoal = financialSettings?.monthly_goal ?? config.monthlyGoal;

  // Load config on mount
  useEffect(() => {
    const saved = localStorage.getItem('gp_fin_config');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  // Helper function to render tab buttons
  const TabButton = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
        activeTab === id 
          ? 'text-yellow-600 bg-yellow-500/10' 
          : 'text-txt-muted hover:text-txt-main hover:bg-surface'
      }`}
    >
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-yellow-600' : 'text-txt-muted'}`} />
      {label}
      {activeTab === id && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500"></div>
      )}
    </button>
  );

  // Mock calculation for Goal Progress based on static data vs Config
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: config.showCents ? 2 : 0 });

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
  const adjustDateRangeForDue = (dueMs: number) => {
    if (!Number.isFinite(dueMs)) return;
    const currentStartMs = parseDate(startDate);
    const currentEndMs = parseDate(endDate) + 24 * 60 * 60 * 1000 - 1;
    const dueStr = new Date(dueMs).toISOString().slice(0, 10);
    if (dueMs < currentStartMs) setStartDate(dueStr);
    if (dueMs > currentEndMs) setEndDate(dueStr);
  };
  type AuditOrder = {
    id: string;
    numeroOs: string;
    depositoId: string | null;
    clienteId: string | null;
    clienteNome: string;
    entregadorId: string | null;
    status: string;
    statusEntrega?: string | null;
    tipoAtendimento: string;
    total: number;
    createdAtMs: number;
    concludedAtMs: number;
    historico: any[];
    pagamentos: any[];
  };
  const normalizeOrder = (row: any): AuditOrder => {
    const historico = row.historico_json ?? row.historico ?? row.history ?? [];
    const pagamentos = row.pagamentos_json ?? row.pagamentos ?? row.payments ?? [];
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
      createdAtMs,
      concludedAtMs,
      historico: Array.isArray(historico) ? historico : [],
      pagamentos: Array.isArray(pagamentos) ? pagamentos : [],
    };
  };
  const isOpenOrder = (order: AuditOrder) => {
    const status = String(order.status ?? '').toUpperCase();
    const delivery = String(order.statusEntrega ?? '').toUpperCase();
    return (
      status === 'ABERTO' ||
      status === 'OPEN' ||
      status === 'PENDENTE' ||
      status === 'EM_ANDAMENTO' ||
      status === 'PENDENTE_ENTREGA' ||
      delivery === 'EM_ROTA'
    );
  };
  const startMs = parseDate(startDate);
  const endMs = parseDate(endDate);
  const endRangeMs = endMs + 24 * 60 * 60 * 1000 - 1;
  const auditLoading =
    activeTab === 'audit' &&
    (auditOrdersRaw === undefined ||
      auditEmployeesRaw === undefined ||
      auditDepositsRaw === undefined ||
      auditClientsRaw === undefined);
  const auditError = null;
  const auditOrders = useMemo(() => {
    return (auditOrdersRaw ?? [])
      .map(normalizeOrder)
      .filter((o) => (o.createdAtMs ? o.createdAtMs >= startMs && o.createdAtMs <= endRangeMs : false))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [auditOrdersRaw, startMs, endRangeMs]);
  const auditEmployees = auditEmployeesRaw ?? [];
  const auditDeposits = auditDepositsRaw ?? [];
  const auditClients = auditClientsRaw ?? [];

  const receivableItems = (receivables || []).map((r) => {
    const total = Number(r.valor_total ?? 0);
    const paid = Number(r.valor_pago ?? 0);
    const remaining = Math.max(0, total - paid);
    const due = r.vencimento_em;
    const overdue = due < Date.now() && remaining > 0;
    const status = overdue ? 'VENCIDO' : r.status;
    const requiresBoleto = (r as any).requires_boleto ?? false;
    return { ...r, total, paid, remaining, overdue, status, requires_boleto: requiresBoleto };
  });

  const paymentMethodMap = new Map((paymentMethods || []).map((m) => [m.id, m.nome]));

  const selectedReceivable = detailId ? (receivableItems.find((r) => r.id === detailId) || null) : null;
  const selectedBoletoReceivable = selectedBoletoReceivableId
    ? receivableItems.find((r) => r.id === selectedBoletoReceivableId) || null
    : null;

  const receivableListFiltered = receivableItems.filter((r) => {
    if (!Number.isFinite(r.vencimento_em)) return false;
    if (startMs && r.vencimento_em < startMs) return false;
    if (endMs && r.vencimento_em > endMs + 24 * 60 * 60 * 1000) return false;
    if (receivableFilter === 'personal' && !r.is_personal) return false;
    if (receivableFilter === 'with-client' && !r.client_id) return false;
    return true;
  });

  const receivablesOpenTotal = receivableItems
    .filter((r) => r.status !== 'PAGO')
    .reduce((sum, r) => sum + r.remaining, 0);

  const receivablesUpcomingTotal = receivableListFiltered
    .filter((r) => r.status !== 'PAGO')
    .reduce((sum, r) => sum + r.remaining, 0);

  useEffect(() => {
    if (activeTab !== 'receivable') return;
    let alive = true;
    const loadBoletos = async () => {
      const pendingIds = receivableListFiltered
        .filter((r) => r.requires_boleto)
        .map((r) => r.id)
        .filter((id) => !Object.prototype.hasOwnProperty.call(boletoCache, id));
      if (!pendingIds.length) return;

      const results = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const existing = await boletosRepo.getByReceivableId(id);
            return { id, boleto: existing, ok: true };
          } catch (err) {
            return { id, boleto: null, ok: false };
          }
        })
      );

      if (!alive) return;
      setBoletoCache((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (!result.ok) continue;
          if (!Object.prototype.hasOwnProperty.call(next, result.id)) {
            next[result.id] = result.boleto;
          }
        }
        return next;
      });
    };

    void loadBoletos();
    return () => {
      alive = false;
    };
  }, [activeTab, receivableListFiltered, boletoCache]);

  const getBoletoButtonTone = (boleto?: Boleto | null) => {
    if (!boleto) {
      return 'bg-app text-txt-muted border-bdr hover:text-txt-main';
    }
    if (boleto.status === 'PAGO') {
      return 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20';
    }
    if (boleto.status === 'CANCELADO') {
      return 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20';
    }
    return 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20';
  };

  const getBoletoButtonLabel = (boleto?: Boleto | null) => (boleto ? 'Ver boleto' : 'Emitir');

  const openBoletoModalFor = (receivableId: string) => {
    setSelectedBoletoReceivableId(receivableId);
    setBoletoModalOpen(true);
  };

  const handleBoletoSaved = (boleto: Boleto) => {
    setBoletoCache((prev) => ({ ...prev, [boleto.receivable_id]: boleto }));
  };

  const handleCloseBoletoModal = () => {
    setBoletoModalOpen(false);
    setSelectedBoletoReceivableId(null);
  };

  const payAll = async (id: string, methodId?: string, paidDate?: string, obs?: string) => {
    const r = receivableItems.find((x) => x.id === id);
    if (!r) return;
    const remaining = r.remaining;
    if (remaining <= 0) return alert('Nada pendente para quitar.');
    const paidAt = paidDate ? new Date(`${paidDate}T00:00:00`).getTime() : undefined;
    await addReceivablePayment(id, remaining, 'user-1', methodId || null, paidAt, obs);
  };

  const payPartial = async (id: string, valueStr: string, methodId?: string, paidDate?: string, obs?: string) => {
    const r = receivableItems.find((x) => x.id === id);
    if (!r) return;
    const remaining = r.remaining;
    const val = Number(valueStr.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) return alert('Valor inválido.');
    if (val > remaining) return alert('Valor maior que o pendente.');
    const paidAt = paidDate ? new Date(`${paidDate}T00:00:00`).getTime() : undefined;
    await addReceivablePayment(id, val, 'user-1', methodId || null, paidAt, obs);
  };

  const changeDueDate = async (id: string, dateStr: string) => {
    const dueMs = new Date(dateStr + 'T00:00:00').getTime();
    if (!Number.isFinite(dueMs)) return alert('Data inválida.');
    await updateReceivable(id, { vencimento_em: dueMs });
    setNewDueDate('');
    adjustDateRangeForDue(dueMs);
  };

  const addInstallment = async (base: typeof receivableItems[number], amountStr: string, dueStr: string) => {
    if (!base) return alert('Selecione uma conta.');
    const val = Number(amountStr.replace(',', '.'));
    const dueMs = new Date(dueStr + 'T00:00:00').getTime();
    if (!Number.isFinite(val) || val <= 0) return alert('Valor inválido.');
    if (!Number.isFinite(dueMs)) return alert('Data inválida.');
    const created = await createReceivable({
      os_id: base.os_id ?? null,
      payment_method_id: null,
      depositoId: normalizeDepositId(base).depositoId,
      devedor_nome: base.devedor_nome ?? base.description ?? 'Cliente',
      valor_total: val,
      status: 'ABERTO',
      criado_em: Date.now(),
      vencimento_em: dueMs,
      description: base.description ?? null,
      client_id: base.client_id ?? null,
      is_personal: base.is_personal ?? false,
      alert_days_before: base.alert_days_before ?? 1,
      installment_no: (base.installment_no ?? 1) + 1,
      installments_total: base.installments_total ?? 1,
    });
    setInstallmentAmount('');
    adjustDateRangeForDue(dueMs);
    if (created?.id) setDetailId(created.id);
  };

  const savePayment = async () => {
    if (!selectedReceivable) return;
    const valStr = paymentAmount || `${selectedReceivable.remaining}`;
    const val = Number(valStr.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) return alert('Valor inválido.');
    const paidAt = paymentDate ? new Date(`${paymentDate}T00:00:00`).getTime() : undefined;

    if (editingPaymentId) {
      const original = (receivablePayments || []).find((p) => p.id === editingPaymentId);
      const editNote = original
        ? `editado de ${original.valor} para ${val} em ${new Date().toLocaleString('pt-BR')}`
        : 'editado';
      const mergedObs = [paymentObs || null, editNote].filter(Boolean).join(' | ');
      await updateReceivablePayment(editingPaymentId, {
        valor: val,
        data_hora: paidAt ?? Date.now(),
        payment_method_id: paymentMethodId || null,
        obs: mergedObs || null,
      }, 'user-1');
    } else {
      await addReceivablePayment(selectedReceivable.id, val, 'user-1', paymentMethodId || null, paidAt, paymentObs);
    }

    setPaymentAmount('');
    setPaymentMethodId('');
    setPaymentObs('');
    setEditingPaymentId(null);
  };


  const removeReceivable = async (id: string) => {
    if (!confirm('Excluir esta conta a receber?')) return;
    await deleteReceivable(id);
  };

  const handleManualCashFlow = async (category: 'SANGRIA' | 'SUPRIMENTO') => {
    if (!activeShift?.id) return alert('Nenhum turno aberto para registrar movimentacao.');
    const label = category === 'SANGRIA' ? 'sangria' : 'suprimento';
    const valueStr = prompt(`Valor da ${label}?`);
    if (!valueStr) return;
    const amount = Number(valueStr.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return alert('Valor invalido.');
    const notes = prompt('Observacao (opcional)') || null;
    await registerCashFlow({
      category,
      amount,
      direction: category === 'SANGRIA' ? 'OUT' : 'IN',
      paymentType: 'cash',
      notes,
      depositId: normalizeDepositId(activeShift).depositoId,
      userName: undefined,
    });
  };

  // Dados reais devem vir de API/consulta; iniciamos zerado para evitar mocks.
  const revenue = receivablesUpcomingTotal;
  const costs = 0;
  const paymentBreakdown: { label: string; val: number; pct: number; color: string }[] = [];
  const products: { name: string; sales: number; unitProfit: number; total: number }[] = [];
  const cashflowEntries = useMemo(() => {
    const items = (cashFlowEntriesRaw ?? [])
      .filter((entry: any) => {
        const createdAt = Number(entry.created_at ?? 0) || 0;
        return createdAt >= startMs && createdAt <= endRangeMs;
      })
      .sort((a: any, b: any) => (a.created_at ?? 0) - (b.created_at ?? 0));

    let running = 0;
    return items.map((entry: any) => {
      const createdAt = Number(entry.created_at ?? 0) || 0;
      const amount = Number(entry.amount ?? 0) || 0;
      const direction = entry.direction === 'OUT' ? -1 : 1;
      running += direction * amount;
      const category = String(entry.category ?? 'MOVIMENTO').toUpperCase();
      const categoryTone =
        direction > 0 ? 'green' : direction < 0 ? 'red' : 'neutral';
      return {
        id: entry.id,
        time: createdAt ? new Date(createdAt).toLocaleString('pt-BR') : '-',
        description: entry.notes ?? entry.reference_type ?? 'Movimento',
        category,
        categoryTone,
        user: entry.user_name ?? entry.user_id ?? '-',
        value: direction * amount,
        status: entry.status ?? 'POSTED',
        balance: running,
        direction: entry.direction ?? 'IN',
      };
    });
  }, [cashFlowEntriesRaw, startMs, endRangeMs]);

  const hasOpenOrders = useMemo(() => {
    const normalizedShift = normalizeDepositId(activeShift || {});
    if (!activeShift?.opened_at || !normalizedShift.depositoId) return false;
    const shiftStart = activeShift.opened_at;
    const shiftEnd = activeShift.closed_at ?? Date.now();
    return (auditOrdersRaw ?? [])
      .map(normalizeOrder)
      .filter((o) => {
        const created = o.createdAtMs ?? 0;
        if (!created) return false;
        if (o.depositoId && o.depositoId !== normalizedShift.depositoId) return false;
        return created >= shiftStart && created <= shiftEnd;
      })
      .some((o) => isOpenOrder(o));
  }, [activeShift, auditOrdersRaw]);
  const employeeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    auditEmployees.forEach((e: any) => {
      const name = e.nome ?? e.name ?? e.username ?? e.id ?? '';
      if (e.id) map.set(String(e.id), String(name));
    });
    return map;
  }, [auditEmployees]);
  const shiftOrders = useMemo(() => {
    if (!activeShift?.opened_at) return [];
    const normalizedShift = normalizeDepositId(activeShift);
    const shiftStart = activeShift.opened_at;
    const shiftEnd = activeShift.closed_at ?? Date.now();
    return (auditOrdersRaw ?? [])
      .map(normalizeOrder)
      .filter((o) => {
        const created = o.createdAtMs ?? 0;
        if (!created) return false;
        if (normalizedShift.depositoId && o.depositoId && o.depositoId !== normalizedShift.depositoId) return false;
        return created >= shiftStart && created <= shiftEnd;
      })
      .map((o) => {
        const logs = Array.isArray(o.historico) ? o.historico : [];
        const createdLog = logs.find((log: any) =>
          String(log?.acao ?? '').toLowerCase().includes('cri')
        );
        const operador = (createdLog as any)?.usuario ?? (logs[0] as any)?.usuario ?? '-';
        const entregador =
          (o.entregadorId && employeeNameMap.get(String(o.entregadorId))) ||
          o.entregadorId ||
          '-';
        const openedAtMs = o.createdAtMs ?? 0;
        const openedAt = openedAtMs ? new Date(openedAtMs).toLocaleString('pt-BR') : '-';
        const statusParts = [o.status, o.statusEntrega].filter(Boolean).map((s) => String(s));
        return {
          id: o.id,
          osNumber: o.numeroOs || o.id,
          openedAt,
          openedAtMs,
          operador,
          entregador,
          status: statusParts.length ? statusParts.join(' / ') : '-',
          isOpen: isOpenOrder(o),
        };
      })
      .sort((a, b) => (b.openedAtMs || 0) - (a.openedAtMs || 0));
  }, [activeShift, auditOrdersRaw, employeeNameMap]);
  const shiftStockMovements = useMemo(() => {
    if (!activeShift?.opened_at) return [];
    const normalizedShift = normalizeDepositId(activeShift);
    const shiftStart = activeShift.opened_at;
    const shiftEnd = activeShift.closed_at ?? Date.now();
    return (stockMovementsRaw ?? [])
      .map((m: any) => {
        const whenMs = new Date(m.dataHora).getTime();
        return { ...m, whenMs };
      })
      .filter((m: any) => {
        if (!m.whenMs) return false;
        if (normalizedShift.depositoId && m.depositoId && m.depositoId !== normalizedShift.depositoId) return false;
        return m.whenMs >= shiftStart && m.whenMs <= shiftEnd;
      })
      .map((m: any) => ({
        id: m.id,
        when: m.whenMs ? new Date(m.whenMs).toLocaleString('pt-BR') : '-',
        produto: m.produtoNome ?? '-',
        tipo: m.tipo ?? '-',
        quantidade: Number(m.quantidade ?? 0) || 0,
        operador: m.usuarioNome ?? m.usuarioId ?? '-',
        motivo: m.motivo ?? m.origem ?? '-',
        whenMs: m.whenMs ?? 0,
      }))
      .sort((a, b) => (b.whenMs || 0) - (a.whenMs || 0));
  }, [activeShift, stockMovementsRaw]);
  const depositNameMap = useMemo(() => {
    const map = new Map<string, string>();
    auditDeposits.forEach((d: any) => {
      const name = d.nome ?? d.name ?? d.id ?? '';
      if (d.id) map.set(String(d.id), String(name));
    });
    return map;
  }, [auditDeposits]);
  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    auditClients.forEach((c: any) => {
      const name = c.nome ?? c.name ?? c.id ?? '';
      if (c.id) map.set(String(c.id), String(name));
    });
    return map;
  }, [auditClients]);
  const auditEntries: {
    osNumber: string;
    client: string;
    driver: string;
    openedAt: string;
    closedAt: string;
    durationMinutes: number;
    status: 'CONCLUIDO' | 'PENDENTE' | 'CANCELADO';
  }[] = useMemo(() => {
    return auditOrders.map((o) => {
      const driver =
        (o.entregadorId && employeeNameMap.get(String(o.entregadorId))) ||
        o.entregadorId ||
        '-';
      const client =
        o.clienteNome ||
        (o.clienteId && clientNameMap.get(String(o.clienteId))) ||
        o.clienteId ||
        '-';
      const openedAt = o.createdAtMs ? new Date(o.createdAtMs).toLocaleString('pt-BR') : '-';
      const closedAt = o.concludedAtMs ? new Date(o.concludedAtMs).toLocaleString('pt-BR') : '-';
      const durationMinutes =
        o.createdAtMs && o.concludedAtMs && o.concludedAtMs >= o.createdAtMs
          ? Math.round((o.concludedAtMs - o.createdAtMs) / 60000)
          : 0;
      const normalizedStatus = String(o.status ?? '').toUpperCase();
      const status =
        normalizedStatus === 'CONCLUIDA' || normalizedStatus === 'CONCLUIDO'
          ? 'CONCLUIDO'
          : normalizedStatus === 'CANCELADA' || normalizedStatus === 'CANCELADO'
            ? 'CANCELADO'
            : 'PENDENTE';
      return {
        osNumber: o.numeroOs || o.id,
        client,
        driver,
        openedAt,
        closedAt,
        durationMinutes,
        status,
      };
    });
  }, [auditOrders, clientNameMap, employeeNameMap]);
  const auditMetrics = useMemo(() => {
    const normalizeText = (value: any) =>
      String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
    const driverCounts: Record<string, number> = {};
    const driverSpeed: Record<string, { total: number; count: number }> = {};
    const depositSales: Record<string, number> = {};
    const clientCounts: Record<string, number> = {};
    const clientSales: Record<string, number> = {};
    const cashierCounts: Record<string, { open: number; close: number }> = {};

    auditOrders.forEach((o) => {
      const isConcluded = String(o.status ?? '').toUpperCase() === 'CONCLUIDA';
      // Novo fluxo (v2.0): DELIVERY é o tipo correto para entregas
      const isDelivery = String(o.tipoAtendimento ?? '').toUpperCase() === 'DELIVERY';
      if (isConcluded && isDelivery && o.entregadorId) {
        const key = String(o.entregadorId);
        driverCounts[key] = (driverCounts[key] || 0) + 1;
        if (o.createdAtMs && o.concludedAtMs && o.concludedAtMs >= o.createdAtMs) {
          const diffMin = (o.concludedAtMs - o.createdAtMs) / 60000;
          if (!driverSpeed[key]) driverSpeed[key] = { total: 0, count: 0 };
          driverSpeed[key].total += diffMin;
          driverSpeed[key].count += 1;
        }
      }

      if (isConcluded && o.depositoId) {
        const depKey = String(o.depositoId);
        depositSales[depKey] = (depositSales[depKey] || 0) + Number(o.total ?? 0);
      }

      const clientKey = String(o.clienteId ?? o.clienteNome ?? '');
      if (clientKey) {
        if (String(o.status ?? '').toUpperCase() !== 'CANCELADA') {
          clientCounts[clientKey] = (clientCounts[clientKey] || 0) + 1;
        }
        if (isConcluded) {
          clientSales[clientKey] = (clientSales[clientKey] || 0) + Number(o.total ?? 0);
        }
      }

      const logs = Array.isArray(o.historico) ? o.historico : [];
      logs.forEach((log: any) => {
        const user =
          log.usuario ??
          log.user ??
          log.username ??
          log.usuarioNome ??
          log.user_name ??
          'Sistema';
        const action = normalizeText(log.acao ?? log.action ?? '');
        const detail = normalizeText(log.detalhe ?? log.detail ?? '');
        if (!cashierCounts[user]) cashierCounts[user] = { open: 0, close: 0 };
        if (action.includes('cri')) cashierCounts[user].open += 1;
        const isCloseAction =
          action.includes('conclu') ||
          (action.includes('mudan') && detail.includes('conclu')) ||
          (action.includes('status') && detail.includes('conclu'));
        if (isCloseAction) cashierCounts[user].close += 1;
      });
    });

    const pickTop = (map: Record<string, number>) => {
      let bestKey = '';
      let bestVal = 0;
      Object.entries(map).forEach(([key, val]) => {
        if (val > bestVal) {
          bestKey = key;
          bestVal = val;
        }
      });
      return { key: bestKey, value: bestVal };
    };

    const topDriver = pickTop(driverCounts);
    let fastestDriverKey = '';
    let fastestAvg = 0;
    Object.entries(driverSpeed).forEach(([key, info]) => {
      if (!info.count) return;
      const avg = info.total / info.count;
      if (!fastestDriverKey || avg < fastestAvg) {
        fastestDriverKey = key;
        fastestAvg = avg;
      }
    });
    const topDeposit = pickTop(depositSales);
    const topClientByOrders = pickTop(clientCounts);
    const topClientByValue = pickTop(clientSales);

    let topCashierKey = '';
    let topCashierScore = 0;
    let topCashierOpen = 0;
    let topCashierClose = 0;
    Object.entries(cashierCounts).forEach(([key, info]) => {
      const score = info.open + info.close;
      if (score > topCashierScore) {
        topCashierKey = key;
        topCashierScore = score;
        topCashierOpen = info.open;
        topCashierClose = info.close;
      }
    });

    return {
      topDriver: {
        name: topDriver.key ? employeeNameMap.get(topDriver.key) || topDriver.key : '-',
        count: topDriver.value,
      },
      fastestDriver: {
        name: fastestDriverKey ? employeeNameMap.get(fastestDriverKey) || fastestDriverKey : '-',
        avgMinutes: fastestAvg ? Math.round(fastestAvg) : 0,
      },
      topDeposit: {
        name: topDeposit.key ? depositNameMap.get(topDeposit.key) || topDeposit.key : '-',
        total: topDeposit.value,
      },
      topCashier: {
        name: topCashierKey || '-',
        open: topCashierOpen,
        close: topCashierClose,
      },
      topClientByValue: {
        name: topClientByValue.key
          ? clientNameMap.get(topClientByValue.key) || topClientByValue.key
          : '-',
        total: topClientByValue.value,
      },
      topClientByOrders: {
        name: topClientByOrders.key
          ? clientNameMap.get(topClientByOrders.key) || topClientByOrders.key
          : '-',
        count: topClientByOrders.value,
      },
    };
  }, [auditOrders, clientNameMap, depositNameMap, employeeNameMap]);

  const goalPercentage = monthlyGoal > 0 ? Math.min(100, Math.round((revenue / monthlyGoal) * 100)) : 0;
  const remainingGoal = Math.max(0, monthlyGoal - revenue);
  const totalIn = cashflowEntries.reduce((sum, e) => (e.value > 0 ? sum + e.value : sum), 0);
  const totalOut = cashflowEntries.reduce((sum, e) => (e.value < 0 ? sum + Math.abs(e.value) : sum), 0);
  const finalBalance = cashflowEntries.length ? cashflowEntries[cashflowEntries.length - 1].balance : revenue - costs;
  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-3 shadow-sm shrink-0 z-20 transition-colors">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-txt-main tracking-tight">Módulo Financeiro</h2>
              <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Gestão completa de fluxo e resultados</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-app p-1.5 rounded-lg border border-bdr">
            <div className="flex items-center gap-2 px-2 border-r border-bdr">
              <Calendar className="w-4 h-4 text-txt-muted" />
              <input
                type="date"
                className="bg-transparent border-none text-xs font-bold text-txt-main focus:ring-0 w-24 outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 px-2">
              <span className="text-xs text-txt-muted font-bold uppercase">até</span>
              <input
                type="date"
                className="bg-transparent border-none text-xs font-bold text-txt-main focus:ring-0 w-24 outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-xs font-black uppercase tracking-wide transition-colors shadow-sm">
              Filtrar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-txt-muted hover:text-txt-main hover:bg-app rounded-lg text-sm font-bold transition-colors border border-transparent hover:border-bdr">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('delivery-settings')}
                className="flex items-center gap-2 px-3 py-2 text-txt-muted hover:text-txt-main hover:bg-app rounded-lg text-sm font-bold transition-colors border border-transparent hover:border-bdr"
              >
                <Truck className="w-4 h-4" />
                <span className="hidden sm:inline">Taxas de Entrega</span>
              </button>
            )}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-txt-muted hover:text-txt-main hover:bg-app rounded-lg text-sm font-bold transition-colors border border-transparent hover:border-bdr"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurar</span>
            </button>
            <button 
              onClick={onClose}
              className="ml-2 p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mt-6 border-b border-bdr overflow-x-auto no-scrollbar">
          <TabButton id="overview" label="Visão Geral" icon={PieChart} />
          <TabButton id="cashflow" label="Fluxo de Caixa" icon={TrendingUp} />
          <TabButton id="audit" label="Auditoria de O.S." icon={Clock} />
          <TabButton id="receivable" label="Contas a Receber" icon={ArrowDownRight} />
          <TabButton id="payable" label="Contas a Pagar" icon={ArrowUpRight} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-app p-6 transition-colors">
        <div className="max-w-[1600px] mx-auto space-y-6">

          {/* TAB: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Top Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr flex flex-col relative overflow-hidden transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-green-600">
                    <TrendingUp className="w-24 h-24" />
                  </div>
                  <span className="text-xs font-black text-txt-muted uppercase tracking-widest mb-2">Contas a Receber (período)</span>
                  <div className="text-3xl font-black text-txt-main mb-2">{formatCurrency(revenue)}</div>
                  <div className="flex items-center text-xs font-bold w-fit px-2 py-1 rounded border border-bdr text-txt-muted bg-app">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> Previsto para o período selecionado
                  </div>
                </div>

                <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr flex flex-col relative overflow-hidden transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-red-600">
                    <TrendingDown className="w-24 h-24" />
                  </div>
                  <span className="text-xs font-black text-txt-muted uppercase tracking-widest mb-2">Custos & Despesas</span>
                  <div className="text-3xl font-black text-txt-main mb-2">{formatCurrency(costs)}</div>
                  <div className="flex items-center text-xs font-bold w-fit px-2 py-1 rounded border border-bdr text-txt-muted bg-app">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> Previsto para o período selecionado
                  </div>
                </div>

                {/* Dynamic Goal Card */}
                <div className="bg-gradient-to-br from-yellow-500 to-amber-600 p-6 rounded-xl shadow-lg flex flex-col text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-white">
                    <Target className="w-24 h-24" />
                  </div>
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <span className="text-xs font-black text-yellow-100 uppercase tracking-widest mb-1 block">Meta Mensal</span>
                      <div className="text-3xl font-black text-white mb-1">{goalPercentage}%</div>
                      <span className="text-[10px] text-yellow-100 font-bold uppercase tracking-wide">Atingida</span>
                    </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-yellow-100 block">Alvo: R$ {monthlyGoal.toLocaleString('pt-BR')}</span>
                        <span className="text-xs font-bold text-white block mt-1">Falta: R$ {remainingGoal.toLocaleString('pt-BR')}</span>
                      </div>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-3 mt-4 overflow-hidden border border-white/10 z-10">
                    <div className="bg-white rounded-full h-full shadow-[0_0_15px_rgba(255,255,255,0.6)] transition-all duration-1000" style={{ width: `${goalPercentage}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr transition-colors">
                  <h3 className="font-black text-txt-main mb-6 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <PieChart className="w-4 h-4 text-txt-muted" />
                    Formas de Pagamento
                  </h3>
                  {paymentBreakdown.length === 0 ? (
                    <div className="p-6 text-center text-sm text-txt-muted border border-dashed border-bdr rounded-xl bg-app">
                      <p className="font-bold">Nenhum dado financeiro disponível.</p>
                      <p className="text-xs mt-1">Conecte às fontes reais para ver formas de pagamento.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {paymentBreakdown.map((item, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs font-bold mb-2">
                            <span className="text-txt-muted uppercase tracking-wide">{item.label}</span>
                            <span className="text-txt-main">{formatCurrency(item.val)} ({item.pct}%)</span>
                          </div>
                          <div className="w-full bg-app rounded-full h-2.5 border border-bdr">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-surface p-6 rounded-xl shadow-sm border border-bdr transition-colors">
                  <h3 className="font-black text-txt-main mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <TrendingUp className="w-4 h-4 text-txt-muted" />
                    Top Produtos (Rentabilidade)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-txt-muted uppercase font-black border-b border-bdr tracking-wider">
                        <tr>
                          <th className="pb-3 pl-2">Produto</th>
                          <th className="pb-3 text-right">Vendas</th>
                          <th className="pb-3 text-right">Lucro Un.</th>
                          <th className="pb-3 text-right pr-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bdr">
                        {products.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-txt-muted font-bold">
                              Nenhum produto com dados de rentabilidade no período.
                            </td>
                          </tr>
                        ) : (
                          products.map((p, idx) => (
                            <tr key={idx} className="group hover:bg-app transition-colors">
                              <td className="py-3 pl-2 font-bold text-txt-main">{p.nome}</td>
                              <td className="py-3 text-right font-medium text-txt-muted">{p.sales} un</td>
                              <td className="py-3 text-right text-green-600 font-bold">{formatCurrency(p.unitProfit)}</td>
                              <td className="py-3 pr-2 text-right font-black text-txt-main">{formatCurrency(p.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FLUXO DE CAIXA */}
          {activeTab === 'cashflow' && (
            <div className="bg-surface rounded-xl shadow-sm border border-bdr flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300 transition-colors">
              <div className="p-6 border-b border-bdr flex justify-between items-center">
                <div>
                  <h3 className="font-black text-txt-main flex items-center gap-2 text-sm uppercase tracking-wide">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Movimentacao do Caixa
                  </h3>
                  {activeShift?.opened_at && (
                    <p className="text-[11px] font-bold text-txt-muted mt-1">
                      Turno aberto em {new Date(activeShift.opened_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleManualCashFlow('SANGRIA')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-xs font-black uppercase tracking-wide transition-colors border border-red-500/20"
                  >
                    <Minus className="w-4 h-4" />
                    Sangria
                  </button>
                  <button
                    onClick={() => handleManualCashFlow('SUPRIMENTO')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-xs font-black uppercase tracking-wide transition-colors border border-green-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    Suprimento
                  </button>
                </div>
              </div>

              {hasOpenOrders && (
                <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 text-red-500 text-xs font-bold">
                  Ha O.S em aberto ou em rota vinculadas a este turno. Finalize antes de fechar o caixa.
                </div>
              )}

              <div className="px-6 py-4 border-b border-bdr bg-app/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-surface border border-bdr rounded-lg px-4 py-3">
                    <div className="text-[10px] uppercase font-black text-txt-muted">Entradas</div>
                    <div className="text-sm font-black text-green-600">{formatCurrency(totalIn)}</div>
                  </div>
                  <div className="bg-surface border border-bdr rounded-lg px-4 py-3">
                    <div className="text-[10px] uppercase font-black text-txt-muted">Saidas</div>
                    <div className="text-sm font-black text-red-500">{formatCurrency(totalOut)}</div>
                  </div>
                  <div className="bg-surface border border-bdr rounded-lg px-4 py-3">
                    <div className="text-[10px] uppercase font-black text-txt-muted">Saldo</div>
                    <div className="text-sm font-black text-txt-main">{formatCurrency(finalBalance)}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-app text-[10px] text-txt-muted uppercase font-black tracking-wider border-b border-bdr">
                      <tr>
                        <th className="px-6 py-4">Data/Hora</th>
                        <th className="px-6 py-4">Operador</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4 text-right">Valor</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr">
                      {cashflowEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-txt-muted font-bold">
                            Nenhuma movimentacao no periodo selecionado.
                          </td>
                        </tr>
                      ) : (
                        cashflowEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-app transition-colors">
                            <td className="px-6 py-3 font-mono text-txt-muted text-xs">{entry.time}</td>
                            <td className="px-6 py-3 font-medium text-txt-muted">{entry.user}</td>
                            <td className="px-6 py-3">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${
                                    entry.categoryTone === 'green'
                                      ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                      : entry.categoryTone === 'red'
                                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                      : 'bg-surface text-txt-muted border-bdr'
                                  }`}
                                >
                                  {entry.category}
                                </span>
                                {entry.description && (
                                  <span className="text-xs text-txt-muted">{entry.description}</span>
                                )}
                              </div>
                            </td>
                            <td
                              className={`px-6 py-3 text-right font-black ${
                                entry.value < 0 ? 'text-red-500' : 'text-green-600'
                              }`}
                            >
                              {formatCurrency(entry.value)}
                            </td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-1 rounded text-[10px] font-black uppercase border border-bdr bg-app text-txt-muted">
                                {entry.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-bdr bg-app/30 px-6 py-4">
                  <h4 className="text-xs font-black text-txt-main uppercase tracking-widest">O.S. do Turno</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-app text-[10px] text-txt-muted uppercase font-black tracking-wider border-b border-bdr">
                      <tr>
                        <th className="px-6 py-4">O.S.</th>
                        <th className="px-6 py-4">Abertura</th>
                        <th className="px-6 py-4">Operador</th>
                        <th className="px-6 py-4">Entregador</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr">
                      {shiftOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-txt-muted font-bold">
                            Nenhuma O.S. registrada neste turno.
                          </td>
                        </tr>
                      ) : (
                        shiftOrders.map((order) => (
                          <tr
                            key={order.id}
                            className={`hover:bg-app transition-colors ${
                              order.isOpen ? 'bg-red-500/5' : ''
                            }`}
                          >
                            <td className="px-6 py-3 font-black text-txt-main">{order.osNumber}</td>
                            <td className="px-6 py-3 text-xs text-txt-muted">{order.openedAt}</td>
                            <td className="px-6 py-3 text-txt-muted">{order.operador}</td>
                            <td className="px-6 py-3 text-txt-muted">{order.entregador}</td>
                            <td className="px-6 py-3">
                              <span
                                className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                                  order.isOpen
                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                    : 'bg-green-500/10 text-green-600 border-green-500/20'
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-bdr bg-app/30 px-6 py-4">
                  <h4 className="text-xs font-black text-txt-main uppercase tracking-widest">Movimentos de Estoque</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-app text-[10px] text-txt-muted uppercase font-black tracking-wider border-b border-bdr">
                      <tr>
                        <th className="px-6 py-4">Data/Hora</th>
                        <th className="px-6 py-4">Produto</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4 text-right">Qtd.</th>
                        <th className="px-6 py-4">Operador</th>
                        <th className="px-6 py-4">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr">
                      {shiftStockMovements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-txt-muted font-bold">
                            Nenhum movimento de estoque neste turno.
                          </td>
                        </tr>
                      ) : (
                        shiftStockMovements.map((movement) => (
                          <tr key={movement.id} className="hover:bg-app transition-colors">
                            <td className="px-6 py-3 text-xs text-txt-muted">{movement.when}</td>
                            <td className="px-6 py-3 font-medium text-txt-main">{movement.produto}</td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-1 rounded text-[10px] font-black uppercase border border-bdr bg-app text-txt-muted">
                                {movement.tipo}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right font-black text-txt-main">{movement.quantidade}</td>
                            <td className="px-6 py-3 text-txt-muted">{movement.operador}</td>
                            <td className="px-6 py-3 text-xs text-txt-muted">{movement.motivo}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* TAB: AUDITORIA O.S. */}
          {activeTab === 'audit' && (
            <div className="bg-surface rounded-xl shadow-sm border border-bdr flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300 transition-colors">
              <div className="p-6 border-b border-bdr bg-app/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-txt-main flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Clock className="w-5 h-5 text-orange-500" />
                    Tempo de Ciclo de Pedidos (Timeline)
                  </h3>
                  <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 border border-green-500/20">Rápido (&lt; 30min)</span>
                    <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">Médio (30-60min)</span>
                    <span className="px-2 py-1 rounded bg-red-500/10 text-red-600 border border-red-500/20">Crítico (&gt; 60min)</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-bdr bg-app/10">
                {auditLoading && (
                  <p className="text-xs font-bold text-txt-muted mb-3">Carregando dados da auditoria...</p>
                )}
                {!auditLoading && auditError && (
                  <p className="text-xs font-bold text-red-500 mb-3">Erro ao carregar auditoria: {auditError}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <div className="bg-surface border border-bdr rounded-xl p-4">
                    <p className="text-[10px] uppercase font-black text-txt-muted">Entregador com mais entregas</p>
                    <p className="text-sm font-black text-txt-main mt-2">{auditMetrics.topDriver.nome}</p>
                    <p className="text-xs text-txt-muted">{auditMetrics.topDriver.count} entregas</p>
                  </div>
                  <div className="bg-surface border border-bdr rounded-xl p-4">
                    <p className="text-[10px] uppercase font-black text-txt-muted">Entregador mais rapido</p>
                    <p className="text-sm font-black text-txt-main mt-2">{auditMetrics.fastestDriver.nome}</p>
                    <p className="text-xs text-txt-muted">{auditMetrics.fastestDriver.avgMinutes} min medio</p>
                  </div>
                  <div className="bg-surface border border-bdr rounded-xl p-4">
                    <p className="text-[10px] uppercase font-black text-txt-muted">Deposito que mais vendeu</p>
                    <p className="text-sm font-black text-txt-main mt-2">{auditMetrics.topDeposit.nome}</p>
                    <p className="text-xs text-txt-muted">{formatCurrency(auditMetrics.topDeposit.total)}</p>
                  </div>
                  <div className="bg-surface border border-bdr rounded-xl p-4">
                    <p className="text-[10px] uppercase font-black text-txt-muted">Caixa com mais abertura/fechamento</p>
                    <p className="text-sm font-black text-txt-main mt-2">{auditMetrics.topCashier.nome}</p>
                    <p className="text-xs text-txt-muted">{auditMetrics.topCashier.open} aberturas | {auditMetrics.topCashier.close} fechamentos</p>
                  </div>
                  <div className="bg-surface border border-bdr rounded-xl p-4">
                    <p className="text-[10px] uppercase font-black text-txt-muted">Cliente com maior valor</p>
                    <p className="text-sm font-black text-txt-main mt-2">{auditMetrics.topClientByValue.nome}</p>
                    <p className="text-xs text-txt-muted">{formatCurrency(auditMetrics.topClientByValue.total)}</p>
                  </div>
                  <div className="bg-surface border border-bdr rounded-xl p-4">
                    <p className="text-[10px] uppercase font-black text-txt-muted">Cliente com mais pedidos</p>
                    <p className="text-sm font-black text-txt-main mt-2">{auditMetrics.topClientByOrders.nome}</p>
                    <p className="text-xs text-txt-muted">{auditMetrics.topClientByOrders.count} pedidos</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface text-[10px] text-txt-muted uppercase font-black border-b border-bdr tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Nº O.S.</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Entregador</th>
                      <th className="px-6 py-4">Abertura</th>
                      <th className="px-6 py-4">Conclusão</th>
                      <th className="px-6 py-4 text-center">Duração Total</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {auditEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-txt-muted font-bold">
                          Nenhum registro de O.S. no período selecionado.
                        </td>
                      </tr>
                    ) : (
                      auditEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-app transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-txt-main">{entry.osNumber}</td>
                          <td className="px-6 py-4 font-medium text-txt-muted">{entry.client}</td>
                          <td className="px-6 py-4 font-medium text-txt-muted">{entry.driver}</td>
                          <td className="px-6 py-4 text-txt-muted text-xs">{entry.openedAt}</td>
                          <td className="px-6 py-4 text-txt-muted text-xs">{entry.closedAt}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-black text-green-600">{entry.durationMinutes} min</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${entry.status === 'CONCLUIDO' ? 'bg-green-500/10 text-green-600 border-green-500/20' : entry.status === 'PENDENTE' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                              {entry.status === 'CONCLUIDO' ? 'CONCLUÍDO' : entry.status === 'PENDENTE' ? 'PENDENTE' : 'CANCELADO'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CONTAS (Common Layout for Payable/Receivable) */}
          
          {activeTab === 'receivable' && (
            <div className="bg-surface rounded-xl shadow-sm border border-bdr flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300 transition-colors">
              <div className="p-6 border-b border-bdr flex justify-between items-center">
                <div>
                  <h3 className="font-black text-txt-main flex items-center gap-2 text-sm uppercase tracking-wide">
                    <FileText className="w-5 h-5 text-green-500" />
                    Contas a Receber
                  </h3>
                  <p className="text-xs text-txt-muted font-bold">Próximas no período filtrado</p>
                </div>
                <button
                  onClick={() => setReceivableModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide text-white shadow-sm transition-transform active:scale-95 bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Nova Conta
                </button>
              </div>

              <div className="px-6 py-4 border-b border-bdr flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-txt-muted uppercase">Total previsto</span>
                  <span className="text-2xl font-black text-green-500">{formatCurrency(receivablesUpcomingTotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-txt-muted uppercase">Filtro</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReceivableFilter('all')}
                      className={`px-3 py-1.5 rounded text-xs font-black border ${
                        receivableFilter === 'all'
                          ? 'bg-green-600 text-white border-green-500'
                          : 'bg-app text-txt-muted border-bdr'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setReceivableFilter('personal')}
                      className={`px-3 py-1.5 rounded text-xs font-black border ${
                        receivableFilter === 'personal'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-app text-txt-muted border-bdr'
                      }`}
                    >
                      Pessoais
                    </button>
                    <button
                      onClick={() => setReceivableFilter('with-client')}
                      className={`px-3 py-1.5 rounded text-xs font-black border ${
                        receivableFilter === 'with-client'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-app text-txt-muted border-bdr'
                      }`}
                    >
                      Com cliente
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                {receivableListFiltered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-txt-muted p-12">
                    <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-bold mb-2 text-txt-main">Nenhum registro encontrado neste período</p>
                    <p className="text-sm font-medium opacity-70">Use o filtro de datas ou adicione novas contas.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-app text-[10px] text-txt-muted uppercase font-black tracking-wider border-b border-bdr">
                      <tr>
                        <th className="px-4 py-3">Descrição / Cliente</th>
                        <th className="px-4 py-3">Vencimento</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                        <th className="px-4 py-3 text-right">Pago</th>
                        <th className="px-4 py-3 text-right">Pendente</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Tipo</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr">
                      {receivableListFiltered
                        .sort((a, b) => (a.vencimento_em || 0) - (b.vencimento_em || 0))
                        .map((r) => {
                          const boletoEntry = boletoCache[r.id];
                          return (
                            <tr key={r.id} className="hover:bg-app transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-txt-main">{r.description || r.devedor_nome || 'Conta'}</span>
                                  {r.requires_boleto && (
                                    <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] font-black uppercase tracking-wide text-amber-400">
                                      Boleto
                                    </span>
                                  )}
                                </div>
                                {r.devedor_nome && <div className="text-xs text-txt-muted">{r.devedor_nome}</div>}
                              </td>
                            <td className="px-4 py-3 text-txt-muted">{new Date(r.vencimento_em).toLocaleDateString('pt-BR')}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.total)}</td>
                            <td className="px-4 py-3 text-right text-txt-muted">{formatCurrency(r.paid)}</td>
                            <td className="px-4 py-3 text-right font-black text-green-500">{formatCurrency(r.remaining)}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${r.overdue ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}
                              >
                                {r.overdue ? 'Vencido' : r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.is_personal ? (
                                <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-500 text-[10px] font-black uppercase border border-purple-500/20">
                                  Pessoal
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 text-[10px] font-black uppercase border border-green-500/20">
                                  Comércio
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {r.requires_boleto ? (
                                  <button
                                    title={boletoEntry ? 'Ver boleto' : 'Emitir boleto'}
                                    onClick={() => openBoletoModalFor(r.id)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${getBoletoButtonTone(boletoEntry)}`}
                                  >
                                    <Barcode className="w-4 h-4" />
                                    {getBoletoButtonLabel(boletoEntry)}
                                  </button>
                                ) : null}
                                <button
                                  title="Detalhes"
                                  onClick={() => { setDetailId(r.id); setNewDueDate(new Date(r.vencimento_em).toISOString().slice(0, 10)); setPaymentAmount(''); setPaymentMethodId(''); setPaymentDate(new Date().toISOString().slice(0,10)); }}
                                  className="px-2 py-1 rounded text-xs font-bold bg-app border border-bdr text-txt-muted"
                                >
                                  Detalhes
                                </button>
                                <button
                                  title="Registrar pagamento parcial"
                                  onClick={() => { const v = prompt('Valor a registrar?', r.remaining.toFixed(2)); if (v) payPartial(r.id, v, '', undefined); }}
                                  className="p-2 rounded border border-bdr hover:bg-app text-txt-muted"
                                >
                                  <Wallet className="w-4 h-4" />
                                </button>
                                <button
                                  title="Quitar"
                                  onClick={() => payAll(r.id, '', undefined)}
                                  className="px-2 py-1 rounded text-xs font-bold bg-green-600 text-white"
                                >
                                  Baixar
                                </button>
                                <button
                                  title="Excluir"
                                  onClick={() => removeReceivable(r.id)}
                                  className="p-2 rounded border border-red-500/40 text-red-500 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payable' && (
            <div className="bg-surface rounded-xl shadow-sm border border-bdr flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300 transition-colors">
               <div className="p-6 border-b border-bdr flex justify-between items-center">
                <h3 className="font-black text-txt-main flex items-center gap-2 text-sm uppercase tracking-wide">
                  <FileText className="w-5 h-5 text-red-500" />
                  Contas a Pagar
                </h3>
                <button
                  onClick={() => setExpenseModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide text-white shadow-sm transition-transform active:scale-95 bg-red-600 hover:bg-red-700"
                >
                   <Plus className="w-4 h-4" />
                   Nova Despesa
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-txt-muted p-12">
                 <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                 <p className="text-lg font-bold mb-2 text-txt-main">Nenhum registro encontrado neste período</p>
                 <p className="text-sm font-medium opacity-70">Utilize o botão acima para adicionar novos registros manualmente ou altere o filtro de datas.</p>
              </div>
            </div>
          )}


        </div>
      </div>


      {detailId && selectedReceivable && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-3xl rounded-xl border border-bdr shadow-xl text-white flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div>
                <h3 className="text-lg font-black">Detalhes da Conta</h3>
                <p className="text-xs text-txt-muted">{selectedReceivable.description || selectedReceivable.devedor_nome || 'Conta'} · Vence em {new Date(selectedReceivable.vencimento_em).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-2 rounded bg-app border border-bdr text-sm font-bold">Imprimir</button>
                <button onClick={() => setDetailId(null)} className="p-2 rounded hover:bg-red-500/10 text-txt-muted hover:text-red-400">Fechar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-5 py-4 border-b border-bdr text-sm">
              <div>
                <div className="text-txt-muted text-xs uppercase font-bold">Valor</div>
                <div className="text-xl font-black">{formatCurrency(selectedReceivable.total)}</div>
              </div>
              <div>
                <div className="text-txt-muted text-xs uppercase font-bold">Pago</div>
                <div className="text-lg font-semibold text-green-400">{formatCurrency(selectedReceivable.paid)}</div>
              </div>
              <div>
                <div className="text-txt-muted text-xs uppercase font-bold">Pendente</div>
                <div className="text-lg font-black text-amber-400">{formatCurrency(selectedReceivable.remaining)}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded border border-bdr bg-app/60">
                  <h4 className="text-sm font-black mb-3 flex items-center gap-2"><Wallet className="w-4 h-4" /> Registrar pagamento</h4>
                  <div className="space-y-2">
                    <input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Valor" className="w-full p-2 rounded bg-app border border-bdr text-white" />
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-2 rounded bg-app border border-bdr text-white" />
                    <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className="w-full p-2 rounded bg-app border border-bdr text-white">
                      <option value="">Forma de pagamento</option>
                      {(paymentMethods || []).map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                    <input
                      value={paymentObs}
                      onChange={(e) => setPaymentObs(e.target.value)}
                      placeholder="Observações (opcional)"
                      className="w-full p-2 rounded bg-app border border-bdr text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={savePayment}
                        className="flex-1 bg-amber-500 text-black font-black py-2 rounded disabled:opacity-60"
                      >
                        {editingPaymentId ? 'Atualizar' : 'Salvar pagamento'}
                      </button>
                      <button
                        onClick={() => payAll(selectedReceivable.id, paymentMethodId, paymentDate, paymentObs)}
                        className="flex-1 bg-green-600 text-white font-black py-2 rounded"
                      >Quitar pendente</button>
                    </div>
                    {editingPaymentId && (
                      <button
                        onClick={() => { setEditingPaymentId(null); setPaymentAmount(''); setPaymentObs(''); }}
                        className="text-xs text-txt-muted underline"
                      >
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded border border-bdr bg-app/60">
                  <h4 className="text-sm font-black mb-3">Ajustar vencimento</h4>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={newDueDate || new Date(selectedReceivable.vencimento_em).toISOString().slice(0, 10)}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full p-2 rounded bg-app border border-bdr text-white"
                    />
                    <button
                      onClick={() => changeDueDate(selectedReceivable.id, newDueDate || new Date(selectedReceivable.vencimento_em).toISOString().slice(0, 10))}
                      className="w-full bg-blue-600 text-white font-black py-2 rounded"
                    >Salvar nova data</button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded border border-bdr bg-app/60">
                <h4 className="text-sm font-black mb-3">Histórico de pagamentos</h4>
                {(receivablePayments && receivablePayments.length > 0) ? (
                  <div className="space-y-2">
                    {receivablePayments
                      .sort((a, b) => b.data_hora - a.data_hora)
                      .map((p) => (
                        <div key={p.id} className="flex flex-col md:flex-row md:items-center md:justify-between text-sm bg-app rounded px-3 py-2 border border-bdr gap-2">
                          <div>
                            <div className="font-semibold">{formatCurrency(p.valor)}</div>
                            <div className="text-xs text-txt-muted">
                              {new Date(p.data_hora).toLocaleString('pt-BR')}
                              {p.payment_method_id ? ` · Forma: ${paymentMethodMap.get(p.payment_method_id) || p.payment_method_id}` : ''}
                            </div>
                            {p.obs && <div className="text-xs text-amber-400">Obs: {p.obs}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-txt-muted">Usuário: {p.usuario_id}</span>
                            <button
                              className="px-2 py-1 rounded text-xs font-bold bg-app border border-bdr text-txt-muted"
                              onClick={() => {
                                setEditingPaymentId(p.id);
                                setPaymentAmount(String(p.valor));
                                setPaymentMethodId(p.payment_method_id || '');
                                setPaymentDate(new Date(p.data_hora).toISOString().slice(0, 10));
                                setPaymentObs(p.obs || '');
                              }}
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-txt-muted">Nenhum pagamento registrado.</p>
                )}
              </div>

              <div className="p-4 rounded border border-bdr bg-app/60">
                <h4 className="text-sm font-black mb-3">Nova parcela</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} placeholder="Valor da parcela" className="p-2 rounded bg-app border border-bdr text-white" />
                  <input type="date" value={installmentDue} onChange={(e) => setInstallmentDue(e.target.value)} className="p-2 rounded bg-app border border-bdr text-white" />
                  <button
                    onClick={() => addInstallment(selectedReceivable, installmentAmount, installmentDue)}
                    className="bg-amber-500 text-black font-black py-2 rounded disabled:opacity-60"
                    disabled={!installmentAmount}
                  >Gerar parcela</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <GoalConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        defaultGoal={monthlyGoal}
      />
      <NewExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setExpenseModalOpen(false)} 
      />
      <NewReceivableModal
        isOpen={isReceivableModalOpen}
        onClose={() => setReceivableModalOpen(false)}
      />
      {isBoletoModalOpen && selectedBoletoReceivable && (
        <BoletoManagerModal
          receivable={selectedBoletoReceivable}
          onClose={handleCloseBoletoModal}
          onSaved={handleBoletoSaved}
        />
      )}

    </div>
  );
};




