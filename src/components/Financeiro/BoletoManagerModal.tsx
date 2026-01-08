import React, { useEffect, useMemo, useState } from 'react';
import { Barcode, Check, Copy, ExternalLink, Loader2, Pencil, X } from 'lucide-react';
import type { AccountsReceivable } from '@/services/financialService';
import { financialService } from '@/services/financialService';
import { boletoService } from '@/services/boletoService';
import type { Boleto, BoletoStatus } from '@/types/boleto';

type BoletoManagerModalProps = {
  receivable: AccountsReceivable;
  onClose: () => void;
  onSaved?: (boleto: Boleto) => void;
};

type FormState = {
  bank_name: string;
  barcode: string;
  digitable_line: string;
  pdf_url: string;
  status: BoletoStatus;
  due_date: string;
};

const EMPTY_FORM: FormState = {
  bank_name: '',
  barcode: '',
  digitable_line: '',
  pdf_url: '',
  status: 'PENDENTE',
  due_date: '',
};

const statusMeta: Record<BoletoStatus, { label: string; badge: string }> = {
  PENDENTE: { label: 'Pendente', badge: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  GERADO: { label: 'Gerado', badge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' },
  ENVIADO: { label: 'Enviado', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  PAGO: { label: 'Pago', badge: 'bg-green-500/10 text-green-500 border-green-500/30' },
  CANCELADO: { label: 'Cancelado', badge: 'bg-red-500/10 text-red-500 border-red-500/30' },
};

const formatDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export const BoletoManagerModal: React.FC<BoletoManagerModalProps> = ({
  receivable,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [boleto, setBoleto] = useState<Boleto | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const receivableAmount = Number(
    receivable.remaining_amount ?? receivable.original_amount ?? 0
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const existing = await boletoService.getByReceivableId(receivable.id);
        if (!alive) return;
        setBoleto(existing as Boleto | null);
        if (existing) {
          setForm({
            bank_name: existing.bank_name ?? '',
            barcode: existing.barcode ?? '',
            digitable_line: existing.digitable_line ?? '',
            pdf_url: existing.pdf_url ?? '',
            status: (existing.status as BoletoStatus) ?? 'PENDENTE',
            due_date:
              formatDateInput(existing.due_date) ||
              formatDateInput(receivable.due_date),
          });
          setEditing(false);
        } else {
          setForm({
            ...EMPTY_FORM,
            due_date: formatDateInput(receivable.due_date),
          });
          setEditing(true);
        }
      } catch (err) {
        if (!alive) return;
        setErrorMsg('Nao foi possivel carregar o boleto.');
        setBoleto(null);
        setEditing(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [receivable.id, receivable.due_date]);

  const statusInfo = useMemo(() => {
    const key = (boleto?.status as BoletoStatus) ?? 'PENDENTE';
    return statusMeta[key];
  }, [boleto?.status]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!form.bank_name || !form.digitable_line) {
      setErrorMsg('Preencha banco e linha digitavel.');
      return;
    }

    if (!Number.isFinite(receivableAmount) || receivableAmount <= 0) {
      setErrorMsg('Valor do boleto invalido.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        id: boleto?.id,
        receivable_id: receivable.id,
        amount: receivableAmount,
        bank_name: form.bank_name.trim() || null,
        barcode: form.barcode.trim() || null,
        digitable_line: form.digitable_line.trim(),
        pdf_url: form.pdf_url.trim() || null,
        status: form.status || 'PENDENTE',
        due_date: form.due_date || receivable.due_date || null,
        issue_date: boleto?.issue_date ?? null,
      };
      const saved = await boletoService.upsert(payload);
      setBoleto(saved as Boleto);
      setEditing(false);
      onSaved?.(saved as Boleto);
    } catch (err) {
      console.error(err);
      setErrorMsg('Nao foi possivel salvar o boleto.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!boleto?.digitable_line) return;
    try {
      await navigator.clipboard?.writeText(boleto.digitable_line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setErrorMsg('Falha ao copiar a linha digitavel.');
    }
  };

  const handleMarkPaid = async () => {
    if (!boleto?.id) return;
    setErrorMsg(null);
    try {
      setActionLoading(true);
      const updated = await boletoService.updateStatus(boleto.id, 'PAGO');
      await financialService.markReceivableAsPaid(
        receivable.id,
        null,
        Number(receivableAmount || 0)
      );
      setBoleto(updated as Boleto);
      onSaved?.(updated as Boleto);
    } catch (err) {
      console.error(err);
      setErrorMsg('Nao foi possivel marcar como pago.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-bdr bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-bdr px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-500/10 p-2 border border-yellow-500/20">
              <Barcode className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-txt-muted">Gestao de Boleto</p>
              <h3 className="text-lg font-black text-txt-main">
                {editing || !boleto ? 'Cadastrar boleto' : 'Resumo do boleto'}
              </h3>
              <p className="text-xs text-txt-muted font-semibold">
                Conta: {receivable.notes || receivable.client_name || 'Conta'}
              </p>
              <p className="text-[11px] text-txt-muted">
                Valor {formatCurrency(Number(receivableAmount || 0))} | Venc.{' '}
                {receivable.due_date ? new Date(receivable.due_date).toLocaleDateString('pt-BR') : '-'}
              </p>
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

        {loading ? (
          <div className="px-6 py-6 space-y-4 animate-pulse">
            <div className="h-5 w-40 rounded bg-app" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-20 rounded bg-app" />
              <div className="h-20 rounded bg-app" />
            </div>
            <div className="h-24 rounded bg-app" />
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {errorMsg && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMsg}
              </div>
            )}

            {editing || !boleto ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Banco</label>
                    <input
                      className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                      value={form.bank_name}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      placeholder="Banco do Brasil"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Codigo de barras</label>
                    <input
                      className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                      value={form.barcode}
                      onChange={(e) => handleChange('barcode', e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Linha digitavel</label>
                    <input
                      className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                      value={form.digitable_line}
                      onChange={(e) => handleChange('digitable_line', e.target.value)}
                      placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-txt-muted">Link PDF</label>
                    <input
                      className="w-full rounded-lg border border-bdr bg-app px-3 py-2 text-sm text-txt-main focus:border-yellow-600 focus:outline-none"
                      value={form.pdf_url}
                      onChange={(e) => handleChange('pdf_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
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
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-bdr bg-app p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-txt-muted">Banco</div>
                    <div className="text-sm font-black text-txt-main">{boleto.bank_name || '-'}</div>
                    <div className="mt-3 text-xs font-bold uppercase tracking-wide text-txt-muted">Codigo de barras</div>
                    <div className="text-sm font-semibold text-txt-main">{boleto.barcode || '-'}</div>
                  </div>
                  <div className="rounded-xl border border-bdr bg-app p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-txt-muted">Status</div>
                    <div className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-black uppercase ${statusInfo.badge}`}>
                      {statusInfo.label}
                    </div>
                    <div className="mt-3 text-xs font-bold uppercase tracking-wide text-txt-muted">Valor</div>
                    <div className="text-lg font-black text-txt-main">
                      {formatCurrency(Number(boleto.amount || 0))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-bdr bg-app p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-txt-muted">Linha digitavel</div>
                      <div className="font-mono text-xs text-txt-main break-all">{boleto.digitable_line || '-'}</div>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-2 rounded-lg border border-bdr bg-surface px-3 py-2 text-xs font-bold text-txt-muted hover:text-txt-main"
                      disabled={!boleto.digitable_line}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-txt-muted">Vencimento</div>
                      <div className="text-sm text-txt-main">
                        {boleto.due_date ? new Date(boleto.due_date).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-txt-muted">Emissao</div>
                      <div className="text-sm text-txt-main">
                        {boleto.issue_date ? new Date(boleto.issue_date).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {boleto.pdf_url && (
                    <a
                      href={boleto.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-bdr bg-app px-3 py-2 text-xs font-bold text-txt-muted hover:text-txt-main"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver PDF
                    </a>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-bdr bg-app px-3 py-2 text-xs font-bold text-txt-muted hover:text-txt-main"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    onClick={handleMarkPaid}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-green-700 disabled:opacity-60"
                    disabled={actionLoading || boleto?.status === 'PAGO'}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Marcar como pago
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-bdr px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-bdr px-4 py-2 text-sm font-bold text-txt-muted hover:bg-app transition-colors"
            disabled={saving || actionLoading}
          >
            Fechar
          </button>
          {(editing || !boleto) && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
              Salvar dados do boleto
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
