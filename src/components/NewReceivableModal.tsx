import React, { useEffect, useState } from 'react';
import { financialService } from '@/services/financialService';
import { clientService, type Client } from '@/services/clientService';

interface NewReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function NewReceivableModal({ isOpen, onClose, onSaved }: NewReceivableModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    const load = async () => {
      try {
        const rows = await clientService.getAll();
        if (alive) setClients(rows || []);
      } catch (err) {
        console.error('Erro ao carregar clientes', err);
        if (alive) setClients([]);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!description || !amount || !dueDate) {
      alert('Preencha descricao, valor e vencimento.');
      return;
    }

    try {
      setLoading(true);

      const amountNum = parseFloat(amount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        alert('Informe um valor valido.');
        return;
      }

      const dueMs = new Date(`${dueDate}T00:00:00`).getTime();
      if (!Number.isFinite(dueMs)) {
        alert('Data de vencimento invalida.');
        return;
      }

      const client = selectedClientId
        ? clients.find((c) => c.id === selectedClientId) || null
        : null;

      await financialService.createReceivable({
        order_id: null,
        deposit_id: null,
        client_id: selectedClientId || null,
        client_name: client?.name || description,
        original_amount: amountNum,
        paid_amount: 0,
        remaining_amount: amountNum,
        status: 'PENDENTE',
        due_date: new Date(dueMs).toISOString().split('T')[0],
        notes: description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      alert('Conta a receber criada com sucesso!');
      onSaved?.();
      onClose();
      setDescription('');
      setAmount('');
      setDueDate('');
      setSelectedClientId('');
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
            <label className="block text-sm mb-1">Descricao</label>
            <input
              className="w-full p-2 rounded bg-gray-700 border border-gray-600"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Emprestimo, Venda sem nota..."
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
                  {c.name}
                </option>
              ))}
            </select>
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
