import { Pencil, Trash2, CheckCircle2, Ban, Clock3 } from 'lucide-react';
import { PaymentMethod } from '../src/types';

interface PaymentMethodsListProps {
  methods: PaymentMethod[];
  onEdit: (method: PaymentMethod) => void;
  onDelete: (id: string) => void;
}

const receiptLabels: Record<PaymentMethod['receipt_type'], string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'Pix',
  fiado: 'Fiado/Boleto',
  boleto: 'Boleto',
  other: 'Outros',
};

export function PaymentMethodsList({ methods, onEdit, onDelete }: PaymentMethodsListProps) {
  if (!methods.length) {
    return (
      <div className="p-6 text-center text-txt-muted border border-dashed border-bdr rounded-xl bg-app/30">
        Nenhuma forma de pagamento cadastrada.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {methods.map((p) => (
        <div key={p.id} className="bg-surface border border-bdr rounded-xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-txt-muted">Nome</p>
              <h4 className="text-lg font-black text-txt-main">{p.name}</h4>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(p)} className="p-2 rounded-lg hover:bg-app text-txt-muted hover:text-txt-main transition-colors" title="Editar">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(p.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors" title="Excluir">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {receiptLabels[p.receipt_type] ?? 'Tipo' }
            </span>
            <span className={`px-2 py-1 rounded-full border ${p.enters_receivables ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
              {p.enters_receivables ? 'Gera Conta' : 'Não gera'}
            </span>
            <span className="px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1">
              <Clock3 className="w-3 h-3" /> {p.default_due_days}d
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm font-black">
            {p.is_active ? (
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
      ))}
    </div>
  );
}
