import { useEffect, useMemo, useState } from 'react';
import { PaymentMethod, PaymentMethodDepositConfig } from '@/types';
import { Deposit } from '@/domain/types';
import { upsertPaymentMethod, upsertPaymentMethodDepositConfigs } from '@/utils/legacyHelpers';
import { X } from 'lucide-react';

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
  due_days: number;
  max_installments: number;
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
  const [receiptType, setReceiptType] = useState<PaymentMethod['receipt_type']>('cash');
  const [generatesReceivable, setGeneratesReceivable] = useState(false);
  const [depositConfigs, setDepositConfigs] = useState<DepositConfigDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const isImmediateType = receiptType === 'cash' || receiptType === 'pix';

  useEffect(() => {
    if (!isOpen) return;
    setName(initialMethod?.name ?? '');
    const initialReceiptType = initialMethod?.receipt_type ?? 'cash';
    setReceiptType(initialReceiptType);
    setGeneratesReceivable(initialMethod?.generates_receivable ?? false);

    const methodId = initialMethod?.id ?? '';
    const nextConfigs = deposits.map((deposit) => {
      const existing = configs.find(
        (config) => config.payment_method_id === methodId && config.deposit_id === deposit.id
      );
      return {
        deposit_id: deposit.id,
        is_active: existing?.is_active ?? true,
        due_days: existing?.due_days ?? 0,
        max_installments: existing?.max_installments ?? 1,
      };
    });

    setDepositConfigs(nextConfigs);
  }, [isOpen, initialMethod, deposits, configs]);

  useEffect(() => {
    if (isImmediateType) {
      setGeneratesReceivable(false);
    }
  }, [isImmediateType]);

  const canSave = useMemo(() => name.trim().length > 0 && !!receiptType, [name, receiptType]);

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
      alert('Preencha o nome e selecione um tipo.');
      return;
    }

    const effectiveGeneratesReceivable = isImmediateType ? false : generatesReceivable;
    const normalizedConfigs = depositConfigs.map((config) => ({
      ...config,
      due_days: Number(config.due_days) || 0,
      max_installments: Math.max(1, Number(config.max_installments) || 1),
    }));

    if (effectiveGeneratesReceivable) {
      const invalid = normalizedConfigs.filter(
        (config) => config.is_active && config.due_days <= 0
      );
      if (invalid.length > 0) {
        alert('Defina um prazo em dias maior que zero para depósitos ativos.');
        return;
      }
    }

    try {
      setSaving(true);

      const methodId = initialMethod?.id ?? crypto.randomUUID();
      const configsToSave: PaymentMethodDepositConfig[] = normalizedConfigs.map((config) => ({
        payment_method_id: methodId,
        deposit_id: config.deposit_id,
        is_active: config.is_active,
        due_days: effectiveGeneratesReceivable && config.is_active ? config.due_days : 0,
        max_installments: config.is_active ? config.max_installments : 1,
        created_at: null,
        updated_at: null,
      }));

      const payload: PaymentMethod = {
        id: methodId,
        name: name.trim(),
        receipt_type: receiptType,
        generates_receivable: effectiveGeneratesReceivable,
        is_active: configsToSave.some((config) => config.is_active),
        created_at: initialMethod?.created_at ?? null,
        updated_at: initialMethod?.updated_at ?? null,
      };

      const saved = await upsertPaymentMethod(payload);
      if (configsToSave.length > 0) {
        await upsertPaymentMethodDepositConfigs(configsToSave);
      }
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

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-txt-muted">Tipo</label>
            <select
              className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value as PaymentMethod['receipt_type'])}
            >
              <option value="cash">Dinheiro</option>
              <option value="card">Cartao</option>
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
                checked={isImmediateType ? false : generatesReceivable}
                onChange={(e) => setGeneratesReceivable(e.target.checked)}
                disabled={isImmediateType}
              />
              Gera Conta a Receber?
            </label>
            <span className="text-xs text-txt-muted">
              Dinheiro/Pix sempre recebem a vista.
            </span>
          </div>

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
                  due_days: 0,
                  max_installments: 1,
                };
                const disableDueDays = isImmediateType || !generatesReceivable || !config.is_active;
                const disableInstallments = isImmediateType || !config.is_active;

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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-txt-muted">Prazo (dias)</label>
                        <input
                          type="number"
                          min={0}
                          className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={config.due_days}
                          onChange={(e) => updateDepositConfig(deposit.id, { due_days: Number(e.target.value) || 0 })}
                          disabled={disableDueDays}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-txt-muted">Max. parcelas</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm font-bold text-txt-main focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={config.max_installments}
                          onChange={(e) => updateDepositConfig(deposit.id, { max_installments: Number(e.target.value) || 1 })}
                          disabled={disableInstallments}
                        />
                      </div>
                    </div>
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
