import React, { useEffect, useState } from 'react';
// ⚠️ REMOVIDO v3.0: db local (use Services: import { xxxService } from '@/services')
import { Cliente } from '@/domain/types';
import { createReceivable } from '@/domain/repositories/receivables.repo';

interface NewReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewReceivableModal({ isOpen, onClose }: NewReceivableModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isPersonal, setIsPersonal] = useState(false);
  const [alertDays, setAlertDays] = useState(1);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      db.clients.toArray().then((rows) => setClients(rows as unknown as Cliente[]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!description || !amount || !dueDate) {
      alert('Preencha descrição, valor e vencimento.');
      return;
    }

    try {
      setLoading(true);

      const amountNum = parseFloat(amount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        alert('Informe um valor válido.');
        return;
      }

      const dueMs = new Date(`${dueDate}T00:00:00`).getTime();
      if (!Number.isFinite(dueMs)) {
        alert('Data de vencimento inválida.');
        return;
      }

      await createReceivable({
        os_id: null,
        payment_method_id: null,
        deposit_id: null,
        devedor_nome: selectedClientId
          ? clients.find((c) => c.id === selectedClientId)?.nome || 'Cliente'
          : description,
        valor_total: amountNum,
        status: 'ABERTO',
        criado_em: Date.now(),
        vencimento_em: dueMs,
        description,
        client_id: selectedClientId || null,
        is_personal: isPersonal,
        alert_days_before: alertDays,
        installment_no: 1,
        installments_total: 1,
      });

      alert('Conta a receber criada com sucesso!');
      onClose();
      setDescription('');
      setAmount('');
      setDueDate('');
      setSelectedClientId('');
      setIsPersonal(false);
      setAlertDays(1);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md text-white">
        <h2 className="text-xl font-bold mb-4 text-green-400">Nova Conta a Receber</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Descrição</label>
            <input
              className="w-full p-2 rounded bg-gray-700 border border-gray-600"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Empréstimo, Venda sem nota..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Valor (R$)</label>
              <input
                type="number"
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Vencimento</label>
              <input
                type="date"
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Cliente (Opcional)</label>
            <select
              className="w-full p-2 rounded bg-gray-700 border border-gray-600"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={isPersonal}
                onChange={(e) => setIsPersonal(e.target.checked)}
              />
              Marcar como conta pessoal
            </label>

            <div>
              <label className="block text-sm mb-1">Alertar antes</label>
              <select
                className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                value={alertDays}
                onChange={(e) => setAlertDays(Number(e.target.value))}
              >
                <option value={0}>Sem alerta</option>
                <option value={1}>1 dia</option>
                <option value={2}>2 dias</option>
                <option value={3}>3 dias</option>
                <option value={5}>5 dias</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Criar Conta'}
          </button>
        </div>
      </div>
    </div>
  );
}



