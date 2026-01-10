import { useEffect, useMemo, useState } from 'react';
import { PaymentMethod, PaymentMethodDepositConfig } from '@/types';
import { Deposit } from '@/domain/types';
import { createPaymentMethod, updatePaymentMethod, upsertDepositConfig } from '@/services';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposits: Deposit[];
  configs: PaymentMethodDepositConfig[];
  initialMethod?: PaymentMethod | null;
  onSaved?: (method: PaymentMethod) => void;
}

type DepositConfigDraft = {
  deposit_id: string;
  is_active: boolean;
  due_days: string;
};

export function PaymentMethodsModal({
  isOpen,
  onClose,
  deposits,
  configs,
  initialMethod,
  onSaved,
}: PaymentMethodsModalProps) {
  const [name, setName] = useState('');
  const [methodKind, setMethodKind] = useState<PaymentMethod['method_kind']>('CASH');
  const [receiptType, setReceiptType] = useState<PaymentMethod['receipt_type']>('IMMEDIATE');
  const [generatesReceivable, setGeneratesReceivable] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [depositConfigs, setDepositConfigs] = useState<DepositConfigDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const isImmediateType = receiptType === 'IMMEDIATE';

  useEffect(() => {
    if (!isOpen) return;
    setName(initialMethod?.name ?? '');
    setMethodKind(initialMethod?.method_kind ?? 'CASH');
    const initialReceiptType = initialMethod?.receipt_type ?? 'IMMEDIATE';
    setReceiptType(initialReceiptType);
    setGeneratesReceivable(initialMethod?.generates_receivable ?? false);
    setIsActive(initialMethod?.is_active ?? true);

    const methodId = initialMethod?.id ?? '';
    const nextConfigs = deposits.map((deposit) => {
      const existing = configs.find(
        (config) => config.payment_method_id === methodId && config.deposit_id === deposit.id
      );
      return {
        deposit_id: deposit.id,
        is_active: existing?.is_active ?? true,
        due_days: String(existing?.due_days ?? 0),
      };
    });

    setDepositConfigs(nextConfigs);
  }, [isOpen, initialMethod, deposits, configs]);

  useEffect(() => {
    if (isImmediateType) {
      setGeneratesReceivable(false);
    }
  }, [isImmediateType]);

  const canSave = useMemo(
    () => name.trim().length > 0 && !!methodKind && !!receiptType,
    [name, methodKind, receiptType]
  );

  if (!isOpen) return null;

  const updateDepositConfig = (depositId: string, patch: Partial<DepositConfigDraft>) => {
    setDepositConfigs((prev) =>
      prev.map((config) =>
        config.deposit_id === depositId ? { ...config, ...patch } : config
      )
    );
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error('Preencha o nome e selecione um tipo.');
      return;
    }

    const effectiveGeneratesReceivable = isImmediateType ? false : generatesReceivable;
    const normalizedConfigs = depositConfigs.map((config) => ({
      ...config,
      due_days: config.due_days === '' ? Number.NaN : Number(config.due_days),
    }));

    if (receiptType === 'DEFERRED') {
      const invalid = normalizedConfigs.filter(
        (config) =>
          config.is_active &&
          (!Number.isInteger(config.due_days) || config.due_days <= 0)
      );
      if (invalid.length > 0) {
        toast.error('Informe um prazo em dias maior que zero para pagamentos a prazo.');
        return;
      }
    }

    try {
      setSaving(true);

      const basePayload = {
        name: name.trim(),
        method_kind: methodKind,
        receipt_type: receiptType,
        generates_receivable: effectiveGeneratesReceivable,
        is_active: isActive,
      };

      const saved = initialMethod?.id
        ? await updatePaymentMethod(initialMethod.id, {
            ...basePayload,
            updated_at: new Date().toISOString(),
          })
        : await createPaymentMethod(basePayload);

      const methodId = saved.id;
      if (normalizedConfigs.length > 0) {
        await Promise.all(
          normalizedConfigs.map((config) =>
            upsertDepositConfig(config.deposit_id, methodId, {
              is_active: config.is_active,
              due_days: receiptType === 'DEFERRED' && config.is_active ? config.due_days : 0,
            })
          )
        );
      }

      const normalizedSaved: PaymentMethod = {
        id: saved.id,
        name: saved.name ?? basePayload.name,
        method_kind: (saved.method_kind ?? basePayload.method_kind) as PaymentMethod['method_kind'],
        receipt_type: (saved.receipt_type ?? basePayload.receipt_type) as PaymentMethod['receipt_type'],
        generates_receivable: saved.generates_receivable ?? basePayload.generates_receivable,
        is_active: saved.is_active ?? basePayload.is_active,
        created_at: saved.created_at ?? null,
        updated_at: saved.updated_at ?? null,
      };

      onSaved?.(normalizedSaved);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar forma de pagamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-bdr rounded-2xl shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
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
              placeholder="Ex.: Dinheiro, Cartao Credito"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Categoria</label>
              <select
                className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                value={methodKind}
                onChange={(e) => setMethodKind(e.target.value as PaymentMethod['method_kind'])}
              >
                <option value="CASH">Dinheiro</option>
                <option value="PIX">Pix</option>
                <option value="CARD">Cartao</option>
                <option value="FIADO">Fiado</option>
                <option value="BOLETO">Boleto</option>
                <option value="VALE">Vale</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Recebimento</label>
              <select
                className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                value={receiptType}
                onChange={(e) => setReceiptType(e.target.value as PaymentMethod['receipt_type'])}
              >
                <option value="IMMEDIATE">Imediato</option>
                <option value="DEFERRED">A prazo</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-txt-main">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Ativo (global)
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-txt-main">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={isImmediateType ? false : generatesReceivable}
                onChange={(e) => setGeneratesReceivable(e.target.checked)}
                disabled={isImmediateType}
              />
              Gera Conta a Receber?
            </label>
          </div>
          <span className="text-xs text-txt-muted">
            {isImmediateType
              ? 'Recebimento imediato usa prazo 0 e nao gera contas.'
              : 'Para pagamento a prazo, configure o prazo por deposito.'}
          </span>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Config por deposito</label>
              <span className="text-[10px] text-txt-muted">
                {deposits.length} deposito(s)
              </span>
            </div>
            <div className="space-y-2">
              {deposits.map((deposit) => {
                const config = depositConfigs.find((item) => item.deposit_id === deposit.id) || {
                  deposit_id: deposit.id,
                  is_active: true,
                  due_days: '0',
                };
                const disableDueDays = isImmediateType || !config.is_active;

                return (
                  <div key={deposit.id} className="border border-bdr rounded-xl p-3 bg-app/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-txt-main">{deposit.nome}</span>
                      <label className="flex items-center gap-2 text-xs font-black text-txt-muted uppercase">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={config.is_active}
                          onChange={(e) => updateDepositConfig(deposit.id, { is_active: e.target.checked })}
                        />
                        Ativo
                      </label>
                    </div>
                    {receiptType === 'DEFERRED' ? (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-txt-muted">Prazo (dias)</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={config.due_days}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            if (nextValue === '' || /^\d*$/.test(nextValue)) {
                              updateDepositConfig(deposit.id, { due_days: nextValue });
                            }
                          }}
                          disabled={disableDueDays}
                        />
                      </div>
                    ) : (
                      <div className="text-[10px] font-black uppercase tracking-widest text-txt-muted">
                        Prazo: 0 dias (imediato)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
