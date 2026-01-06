import { useEffect, useState } from 'react';
import { db, generateId } from '@/domain/db';
import { enqueueOutboxEvent } from '@/domain/sync/outbox';
import { FinancialSettings } from '../types';

interface GoalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGoal?: number;
}

const FALLBACK_GOAL = 20000;
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export function GoalConfigModal({ isOpen, onClose, defaultGoal }: GoalConfigModalProps) {
  const [goalValue, setGoalValue] = useState<string>('');
  const [rowId, setRowId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      const table = (db as any).financial_settings;
      const byId = await table.get(SETTINGS_ID);
      const first = byId ?? (await table.toCollection().first());
      const current = first ?? null;

      const idToUse = current?.id ?? SETTINGS_ID;
      setRowId(idToUse);

      if (current?.monthly_goal != null) {
        setGoalValue(String(current.monthly_goal));
      } else if (defaultGoal != null) {
        setGoalValue(String(defaultGoal));
      } else {
        setGoalValue(String(FALLBACK_GOAL));
      }
    };

    void load();
  }, [isOpen, defaultGoal]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const numericGoal = Number(goalValue);
    if (Number.isNaN(numericGoal) || numericGoal < 0) {
      alert('Informe um valor válido para a meta mensal.');
      return;
    }

    try {
      setLoading(true);
      const id = SETTINGS_ID;
      const payload: FinancialSettings = {
        id,
        monthly_goal: numericGoal,
        updated_at: new Date().toISOString(),
      };

      await (db as any).financial_settings.put(payload);

      await enqueueOutboxEvent({
        entity: 'financial_settings',
        action: 'UPSERT',
        entity_id: id,
        payload_json: payload,
      });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar meta mensal', error);
      alert('Não foi possível salvar a meta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-surface border border-bdr shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-txt-muted">Configuração</p>
            <h2 className="text-xl font-black text-txt-main">Meta Mensal de Faturamento</h2>
          </div>
          <button
            onClick={onClose}
            className="text-txt-muted hover:text-txt-main transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-txt-muted uppercase tracking-wide">
            Valor da Meta (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted font-bold">R$</span>
            <input
              type="number"
              min="0"
              step="100"
              className="w-full bg-app border border-bdr rounded-xl p-3 pl-10 text-lg font-black text-txt-main focus:ring-2 focus:ring-yellow-500 outline-none"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              placeholder={String(FALLBACK_GOAL)}
            />
          </div>
          <p className="text-[11px] text-txt-muted font-medium">
            Defina o alvo mensal que aparecerá no cartão de "Meta Mensal" e será sincronizado com o servidor.
          </p>
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
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-black uppercase tracking-wide shadow-lg shadow-yellow-500/20 disabled:opacity-60"
            type="button"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
