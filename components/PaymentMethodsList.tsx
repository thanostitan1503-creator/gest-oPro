import { Pencil, Trash2, CheckCircle2, Ban, Clock3 } from 'lucide-react';
import { PaymentMethod, PaymentMethodDepositConfig } from '@/types';
import { Deposit } from '@/domain/types';

interface PaymentMethodsListProps {
  methods: PaymentMethod[];
  configs: PaymentMethodDepositConfig[];
  deposits: Deposit[];
  onEdit: (method: PaymentMethod) => void;
  onDelete: (id: string) => void;
}

const methodKindLabels: Record<PaymentMethod['method_kind'], string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CARD: 'Cartao',
  FIADO: 'Fiado',
  BOLETO: 'Boleto',
  VALE: 'Vale',
  OTHER: 'Outros',
};

const receiptLabels: Record<PaymentMethod['receipt_type'], string> = {
  IMMEDIATE: 'Imediato',
  DEFERRED: 'A prazo',
};

export function PaymentMethodsList({ methods, configs, deposits, onEdit, onDelete }: PaymentMethodsListProps) {
  if (!methods.length) {
    return (
      <div className="p-6 text-center text-txt-muted border border-dashed border-bdr rounded-xl bg-app/30">
        Nenhuma forma de pagamento cadastrada.
      </div>
    );
  }

  const totalDeposits = deposits.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {methods.map((method) => {
        const methodConfigs = configs.filter((config) => config.payment_method_id === method.id);
        const activeConfigs = methodConfigs.filter((config) => config.is_active);
        const activeCount = activeConfigs.length;
        const dueDays = activeConfigs.map((config) => config.due_days).filter((days) => days > 0);
        const dueLabel = (() => {
          if (method.receipt_type === 'IMMEDIATE') return '0d';
          if (dueDays.length === 0) return '0d';
          const min = Math.min(...dueDays);
          const max = Math.max(...dueDays);
          return min === max ? `${min}d` : `${min}-${max}d`;
        })();
        const depositLabel = totalDeposits > 0 ? `${activeCount}/${totalDeposits} dep.` : 'Sem depositos';

        return (
          <div key={method.id} className="bg-surface border border-bdr rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-txt-muted">Nome</p>
                <h4 className="text-lg font-black text-txt-main">{method.name}</h4>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(method)}
                  className="p-2 rounded-lg hover:bg-app text-txt-muted hover:text-txt-main transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(method.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {methodKindLabels[method.method_kind] ?? 'Metodo'}
              </span>
              <span className="px-2 py-1 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">
                {receiptLabels[method.receipt_type] ?? 'Recebimento'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${method.generates_receivable ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}
              >
                {method.generates_receivable ? 'Gera conta' : 'Nao gera'}
              </span>
              <span className="px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1">
                <Clock3 className="w-3 h-3" /> {dueLabel}
              </span>
              <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                {depositLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm font-black">
              {method.is_active ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> ATIVO
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-500">
                  <Ban className="w-4 h-4" /> INATIVO
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
