import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useLiveQuery, db } from '@/utils/legacyHelpers';

export interface OrderItem {
  id: string;
  produtoId: string;
  nome: string;
  tipo: string;
  precoUnitario: number;
  quantidade: number;
  /** Modo de venda escolhido: EXCHANGE (troca) ou FULL (completa) */
  sale_movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null;
}

interface ServiceOrderItemsProps {
  selectedDepositId: string | null;
  items: OrderItem[];
  setItems: (items: OrderItem[]) => void;
  includeProductIds?: string[];
  lockedProductIds?: string[];
  onRemoveItem?: (item: OrderItem) => void;
}

export function ServiceOrderItems({
  selectedDepositId,
  items,
  setItems,
  includeProductIds,
  lockedProductIds,
  onRemoveItem,
}: ServiceOrderItemsProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const includeIdsKey = (includeProductIds || []).join('|');
  const isDeliveryFeeProduct = (p: any) => {
    const flag = p?.is_delivery_fee ?? p?.isDeliveryFee;
    if (flag === true) return true;
    const group = String(p?.product_group ?? p?.codigo ?? '').toLowerCase();
    if (group === 'delivery_fee') return true;
    const name = String(p?.nome ?? p?.name ?? '').toLowerCase();
    return name === 'taxa de entrega';
  };
  const isServiceProduct = (p: any) => {
    if (isDeliveryFeeProduct(p)) return true;
    const track = p?.track_stock ?? p?.trackStock;
    if (track === false) return true;
    return p?.type === 'SERVICE';
  };

  const products = useLiveQuery(async () => {
    if (!selectedDepositId && !(includeProductIds || []).length) return [];
    const all = await db.products.toArray();
    return all.filter((p: any) => {
      // Filtrar apenas produtos ativos
      const isActive = (p.ativo ?? p.is_active ?? true) !== false;
      if (!isActive) return false;

      const deposit = p.deposit_id ?? p.depositoId ?? p.depositId ?? p.deposito_id ?? null;
      
      // Incluir se for produto de serviço (global)
      if (isServiceProduct(p)) return true;
      
      // Incluir se estiver na lista de IDs permitidos
      if ((includeProductIds || []).includes(p.id)) return true;
      
      // Incluir se for produto global (sem depósito)
      if (deposit === null || deposit === '') return true;
      
      // Incluir se pertencer ao depósito selecionado
      if (selectedDepositId && deposit === selectedDepositId) return true;
      
      return false;
    });
  }, [selectedDepositId, includeIdsKey]) || [];

  const productsById = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [products]);

  const handleAddItem = () => {
    const product = productsById.get(selectedProductId);
    if (!product) return;

    const qty = Math.max(1, Number(quantity) || 1);
    const unitPrice = Number(product.preco_padrao ?? product.preco ?? product.price ?? 0) || 0;
    const name = product.nome ?? product.name ?? '';
    const type = isServiceProduct(product) ? 'SERVICO' : product.tipo ?? product.type ?? '';

    const existing = items.find((i) => i.produtoId === product.id);
    if (existing) {
      const next = items.map((i) =>
        i.id === existing.id
          ? { ...i, quantidade: i.quantidade + qty }
          : i
      );
      setItems(next);
    } else {
      const nextItem: OrderItem = {
        id: crypto.randomUUID(),
        produtoId: product.id,
        nome: name,
        tipo: type,
        precoUnitario: unitPrice,
        quantidade: qty,
      };
      setItems([...items, nextItem]);
    }

    setQuantity('1');
    setSelectedProductId('');
  };

  const handleUpdateQuantity = (itemId: string, value: string) => {
    const qty = Math.max(1, Number(value) || 1);
    const next = items.map((i) =>
      i.id === itemId
        ? { ...i, quantidade: qty }
        : i
    );
    setItems(next);
  };

  const handleRemoveItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item && onRemoveItem) onRemoveItem(item);
    setItems(items.filter((i) => i.id !== itemId));
  };

  const handleQuantityKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddItem();
    }
  };

  if (!selectedDepositId) {
    return <div className="text-sm text-gray-600">Selecione um deposito primeiro</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Produto</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="h-8 px-2 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="">Selecionar produto</option>
            {products
              .filter((p: any) => !lockedProductIds?.includes(p.id))
              .map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nome ?? p.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Qtd</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={handleQuantityKeyDown}
            className="h-8 w-24 px-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleAddItem}
          className="h-8 px-3 rounded bg-blue-600 text-white text-sm"
        >
          Adicionar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-700 border border-gray-200">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-2 py-2 text-left">Produto</th>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="px-2 py-2 text-left">Preco Unit.</th>
              <th className="px-2 py-2 text-left">Qtd</th>
              <th className="px-2 py-2 text-left">Total</th>
              <th className="px-2 py-2 text-left">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Nenhum item adicionado.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isLocked = lockedProductIds?.includes(item.produtoId);
                const saleModeLabel = item.sale_movement_type === 'EXCHANGE' 
                  ? '🔁 TROCA' 
                  : item.sale_movement_type === 'FULL' 
                    ? '📦 COMPLETA' 
                    : null;
                return (
                  <tr key={item.id} className="border-t border-gray-200">
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <span>{item.nome}</span>
                        {saleModeLabel && (
                          <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${
                            item.sale_movement_type === 'EXCHANGE' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {saleModeLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">{item.tipo}</td>
                    <td className="px-2 py-2">R$ {item.precoUnitario.toFixed(2)}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => handleUpdateQuantity(item.id, e.target.value)}
                        disabled={isLocked}
                        className={`w-20 h-7 px-2 border border-gray-300 rounded ${isLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      R$ {(item.precoUnitario * item.quantidade).toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Remover item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



