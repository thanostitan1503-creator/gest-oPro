import React, { useEffect, useMemo, useState } from 'react';
import { Barcode, Link as LinkIcon, Loader2, Save, X } from 'lucide-react';
import type { Boleto } from '@/types/boleto';
import { boletoService } from '@/services/boletoService';

type BoletoModalProps = {
  isOpen: boolean;
  receivableId: string | null;
  receivableLabel?: string | null;
  initialBoleto?: Boleto | null;
  onSaved?: (boleto: Boleto) => void;
  onClose: () => void;
};

const EMPTY_FORM = {
  amount: '',
  bank_name: '',
  barcode: '',
  digitable_line: '',
  pdf_url: '',
  status: 'PENDENTE',
  due_date: '',
};

export const BoletoModal: React.FC<BoletoModalProps> = ({
  isOpen,
  receivableId,
  receivableLabel,
  initialBoleto,
  onSaved,
  onClose,
}) => {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditing = useMemo(() => !!initialBoleto?.id, [initialBoleto]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialBoleto) {
      setForm({
        amount: Number(initialBoleto.amount || 0).toFixed(2),
        bank_name: initialBoleto.bank_name ?? '',
        barcode: initialBoleto.barcode ?? '',
        digitable_line: initialBoleto.digitable_line ?? '',
        pdf_url: initialBoleto.pdf_url ?? '',
        status: initialBoleto.status ?? 'PENDENTE',
        due_date: (initialBoleto.due_date ?? '').slice(0, 10),
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [initialBoleto, isOpen]);

  if (!isOpen || !receivableId) return null;

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setErrorMsg(null);

    const amountValue = Number(form.amount.replace(',', '.'));
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setErrorMsg('Informe um valor valido.');
      return;
    }

    if (!form.bank_name || !form.digitable_line) {
      setErrorMsg('Preencha banco e linha digitavel.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        id: initialBoleto?.id,
        receivable_id: receivableId,
        amount: amountValue,
        bank_name: form.bank_name.trim() || null,
        barcode: form.barcode.trim() || null,
        digitable_line: form.digitable_line.trim(),
        pdf_url: form.pdf_url.trim() || null,
        status: form.status || 'PENDENTE',
        due_date: form.due_date || null,
        issue_date: initialBoleto?.issue_date ?? null,
      };

      const saved = await boletoService.upsert(payload);

      onSaved?.(saved as Boleto);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Nao foi possivel salvar o boleto. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-bdr bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-bdr px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-500/10 p-2 border border-yellow-500/20">
              <Barcode className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-txt-muted">Gestao de Boleto</p>
              <h3 className="text-lg font-black text-txt-main">
                {isEditing ? 'Visualizar / Editar Boleto' : 'Gerar Boleto'}
              </h3>
              {receivableLabel && (
                <p className="text-xs text-txt-muted font-semibold">Conta: {receivableLabel}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-txt-muted hover:bg-app hover:text-txt-main transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Valor</label>
              <input
                type="number"
                className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Banco</label>
              <input
                className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                value={form.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="Ex: Banco do Brasil"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Codigo de barras</label>
              <input
                className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                value={form.barcode}
                onChange={(e) => handleChange('barcode', e.target.value)}
                placeholder="Identificador"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Linha Digitavel</label>
              <input
                className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                value={form.digitable_line}
                onChange={(e) => handleChange('digitable_line', e.target.value)}
                placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Link do PDF</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                  value={form.pdf_url}
                  onChange={(e) => handleChange('pdf_url', e.target.value)}
                  placeholder="https://..."
                />
                {form.pdf_url && (
                  <a
                    href={form.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-bdr bg-app px-3 py-2 text-xs font-bold text-txt-muted hover:text-txt-main"
                    title="Abrir PDF"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Vencimento</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                  value={form.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Status</label>
                <select
                  className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                  value={form.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="GERADO">Gerado</option>
                  <option value="ENVIADO">Enviado</option>
                  <option value="PAGO">Pago</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-bdr px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-bdr px-4 py-2 text-sm font-bold text-txt-muted hover:bg-app transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar boleto
          </button>
        </div>
      </div>
    </div>
  );
};
