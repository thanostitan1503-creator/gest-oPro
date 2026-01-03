import React, { useState } from 'react';
import { db, generateId } from '../../domain/db';
import { enqueueOutboxEvent } from '../../domain/sync/outbox';
import { Expense } from '../types';

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewExpenseModal({ isOpen, onClose }: NewExpenseModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('FIXA');
  const [alertDays, setAlertDays] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!description || !amount || !dueDate) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);

      const nowIso = new Date().toISOString();
      const newExpense: Expense = {
        id: generateId(),
        description,
        amount: parseFloat(amount),
        due_date: dueDate, // YYYY-MM-DD
        status: isPaid ? 'PAGO' : 'PENDENTE',
        paid_date: isPaid ? nowIso : null,
        category,
        is_fixed: category === 'FIXA' || category === 'SALARIO',
        deposit_id: null, // Pode adicionar select de depósito depois se quiser
        alert_days_before: Number(alertDays),
        created_at: nowIso,
        updated_at: nowIso,
      };

      // 1. Salva no Banco Local
      await (db as any).expenses.put(newExpense);

      // 2. Agenda Sincronização via outbox oficial
      await enqueueOutboxEvent({
        entity: 'expenses',
        action: 'UPSERT',
        entity_id: newExpense.id,
        payload_json: newExpense,
      });

      alert('Despesa salva com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md text-white">
        <h2 className="text-xl font-bold mb-4">Nova Despesa</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Descrição</label>
            <input 
              className="w-full p-2 rounded bg-gray-700 border border-gray-600"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Conta de Luz"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Valor (R$)</label>
              <input 
                type="number"
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Vencimento</label>
              <input 
                type="date"
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Categoria</label>
              <select 
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="FIXA">Despesa Fixa</option>
                <option value="VARIAVEL">Despesa Variável</option>
                <option value="SALARIO">Salário / Pessoal</option>
                <option value="IMPOSTO">Imposto</option>
              </select>
            </div>
            <div>
               <label className="block text-sm mb-1">Alerta Vencimento</label>
               <select 
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={alertDays}
                onChange={e => setAlertDays(Number(e.target.value))}
              >
                <option value={0}>Sem alerta</option>
                <option value={1}>1 dia antes</option>
                <option value={2}>2 dias antes</option>
                <option value={3}>3 dias antes</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input 
              type="checkbox" 
              id="paidCheck"
              checked={isPaid}
              onChange={e => setIsPaid(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="paidCheck" className="text-sm cursor-pointer select-none">
              Já está pago? (Baixa automática)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500">
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="px-4 py-2 rounded bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Despesa'}
          </button>
        </div>
      </div>
    </div>
  );
}
