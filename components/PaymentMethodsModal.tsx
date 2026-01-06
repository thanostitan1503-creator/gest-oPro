import { useEffect, useMemo, useState } from 'react';
import { PaymentMethod } from '@/types';
import { upsertPaymentMethod } from '@/domain/repositories/paymentMethods.repo';
import { X } from 'lucide-react';

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMethod?: PaymentMethod | null;
  onSaved?: (method: PaymentMethod) => void;
}

export function PaymentMethodsModal({ isOpen, onClose, initialMethod, onSaved }: PaymentMethodsModalProps) {
  const [name, setName] = useState('');
  const [receiptType, setReceiptType] = useState<PaymentMethod['receipt_type']>('cash');
  const [entersReceivables, setEntersReceivables] = useState(false);
  const [defaultDueDays, setDefaultDueDays] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [machineLabel, setMachineLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const isReceivableForcedFalse = receiptType === 'cash' || receiptType === 'pix';

  useEffect(() => {
    if (!isOpen) return;
    setName(initialMethod?.name ?? '');
    const initialReceiptType = initialMethod?.receipt_type ?? 'cash';
    setReceiptType(initialReceiptType);
    setEntersReceivables(initialMethod?.enters_receivables ?? (initialReceiptType === 'card' || initialReceiptType === 'fiado'));
    setDefaultDueDays(initialMethod?.default_due_days ?? 0);
    setIsActive(initialMethod?.is_active ?? true);
    setMachineLabel(initialMethod?.machine_label ?? '');
  }, [isOpen, initialMethod]);

  useEffect(() => {
    if (isReceivableForcedFalse) {
      setEntersReceivables(false);
      setDefaultDueDays(0);
    }
  }, [isReceivableForcedFalse]);

  const canSave = useMemo(() => name.trim().length > 0 && !!receiptType, [name, receiptType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!canSave) {
      alert('Preencha o nome e selecione um tipo.');
      return;
    }

    try {
      setSaving(true);
      const payload: PaymentMethod = {
        id: initialMethod?.id ?? crypto.randomUUID(),
        name: name.trim(),
        receipt_type: receiptType,
        enters_receivables: isReceivableForcedFalse ? false : entersReceivables,
        default_due_days: isReceivableForcedFalse ? 0 : Number(defaultDueDays) || 0,
        is_active: isActive,
        machine_label: machineLabel || undefined,
        created_at: initialMethod?.created_at,
        updated_at: initialMethod?.updated_at,
      };

      const saved = await upsertPaymentMethod(payload);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar forma de pagamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-bdr rounded-2xl shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-txt-muted">Cadastro</p>
            <h2 className="text-xl font-black text-txt-main">Forma de Pagamento</h2>
          </div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-main transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Nome</label>
            <input
              className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Dinheiro, Cartão Crédito"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Tipo</label>
            <select
              className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value as PaymentMethod['receipt_type'])}
            >
              <option value="cash">Dinheiro</option>
              <option value="card">Cartão</option>
              <option value="pix">Pix</option>
              <option value="fiado">Fiado/Boleto</option>
              <option value="boleto">Boleto</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-txt-main">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={isReceivableForcedFalse ? false : entersReceivables}
                onChange={(e) => setEntersReceivables(e.target.checked)}
                disabled={isReceivableForcedFalse}
              />
              Gera Conta a Receber?
            </label>
            <span className="text-xs text-txt-muted">
              Dinheiro/Pix sempre recebem à vista.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Prazo Padrão (dias)</label>
              <input
                type="number"
                min={0}
                className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(Number(e.target.value) || 0)}
                disabled={isReceivableForcedFalse || !entersReceivables}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Rótulo Máquina (opcional)</label>
              <input
                className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                value={machineLabel}
                onChange={(e) => setMachineLabel(e.target.value)}
                placeholder="Ex.: Stone-01"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-txt-main">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Ativo
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-bdr text-txt-muted hover:text-txt-main hover:border-txt-main/40 transition-colors"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide shadow-lg shadow-emerald-600/20 disabled:opacity-60"
            type="button"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
