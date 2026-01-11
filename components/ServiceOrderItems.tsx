import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, HelpCircle, Package, RefreshCw, ShoppingBag, Info, X } from 'lucide-react';
import { useLiveQuery, db } from '@/utils/legacyHelpers';
import { resolvePrice, type PricingRow } from '@/utils/pricing';
import type { ClientSpecialPriceMap } from '@/services';
import { toast } from 'sonner';

const EMPTY_SPECIAL_PRICES: ClientSpecialPriceMap = {};

export interface OrderItem {
  id: string;
  produtoId: string;
  nome: string;
  tipo: string;
  precoUnitario: number;
  quantidade: number;
  /** Modo de venda escolhido: EXCHANGE (troca) ou FULL (completa) */
  sale_movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null;
  priceSource?: 'AUTO' | 'CLIENT_SPECIAL' | 'MANUAL';
  isManualPrice?: boolean;
}

/**
 * 📖 GUIA DE MODALIDADES DE VENDA
 * 
 * As modalidades definem como o estoque será movimentado e qual preço será aplicado:
 * 
 * 🔁 TROCA (EXCHANGE):
 *    - Cliente DEVOLVE um vasilhame vazio e LEVA um cheio
 *    - Preço aplicado: preco_troca (geralmente mais barato)
 *    - Movimento de estoque: SAÍDA do cheio + ENTRADA do vazio
 *    - Uso típico: Cliente que já tem vasilhame
 * 
 * 📦 COMPLETA (FULL):
 *    - Cliente NÃO devolve nada, LEVA produto + casco
 *    - Preço aplicado: preco_completa (inclui valor do casco)
 *    - Movimento de estoque: Apenas SAÍDA do cheio
 *    - Uso típico: Cliente novo ou primeira compra
 * 
 * 🛒 SIMPLES (SIMPLE):
 *    - Venda normal sem troca de vasilhame
 *    - Preço aplicado: preco_venda padrão
 *    - Movimento de estoque: Apenas SAÍDA
 *    - Uso típico: Produtos que não são gás (água, acessórios, etc)
 */

/** Labels e descrições das modalidades para exibição na UI */
const SALE_MODE_INFO = {
  EXCHANGE: {
    label: 'TROCA',
    emoji: '🔁',
    color: 'green',
    bgClass: 'bg-green-50 border-green-500 hover:bg-green-100',
    textClass: 'text-green-700',
    badgeClass: 'bg-green-100 text-green-700',
    description: 'Cliente devolve vasilhame vazio',
    detail: 'O cliente entrega um casco vazio e leva o produto cheio. Preço de TROCA aplicado.',
    stockEffect: '📤 Sai: 1 cheio | 📥 Entra: 1 vazio',
  },
  FULL: {
    label: 'COMPLETA',
    emoji: '📦',
    color: 'blue',
    bgClass: 'bg-blue-50 border-blue-500 hover:bg-blue-100',
    textClass: 'text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700',
    description: 'Cliente leva o casco (novo)',
    detail: 'Cliente novo ou sem casco para devolver. Preço COMPLETO inclui valor do vasilhame.',
    stockEffect: '📤 Sai: 1 cheio (casco incluso)',
  },
  SIMPLE: {
    label: 'SIMPLES',
    emoji: '🛒',
    color: 'gray',
    bgClass: 'bg-gray-50 border-gray-400 hover:bg-gray-100',
    textClass: 'text-gray-700',
    badgeClass: 'bg-gray-100 text-gray-700',
    description: 'Venda normal',
    detail: 'Venda padrão sem troca de vasilhame. Preço de venda normal.',
    stockEffect: '📤 Sai: quantidade vendida',
  },
} as const;

interface ServiceOrderItemsProps {
  selectedDepositId: string | null;
  items: OrderItem[];
  setItems: (items: OrderItem[]) => void;
  includeProductIds?: string[];
  lockedProductIds?: string[];
  onRemoveItem?: (item: OrderItem) => void;
  clientSpecialPrices?: ClientSpecialPriceMap;
}

export function ServiceOrderItems({
  selectedDepositId,
  items,
  setItems,
  includeProductIds,
  lockedProductIds,
  onRemoveItem,
  clientSpecialPrices,
}: ServiceOrderItemsProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedSaleMode, setSelectedSaleMode] = useState<'EXCHANGE' | 'FULL' | 'SIMPLE'>('EXCHANGE');
  const [showSaleModeModal, setShowSaleModeModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const activeDepositId = selectedDepositId ?? null;
  const activeSpecialPrices = clientSpecialPrices ?? EMPTY_SPECIAL_PRICES;

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const parseMoneyInput = (value: string) => {
    if (!value) return 0;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const hasComma = trimmed.includes(',');
    const normalized = hasComma
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const loadPricing = async () => {
    try {
      const rows = await db.product_pricing?.toArray?.();
      setPricingRows(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Erro ao carregar precos por deposito', error);
      setPricingRows([]);
    }
  };

  useEffect(() => {
    void loadPricing();
  }, []);

  useEffect(() => {
    void loadPricing();
  }, [activeDepositId]);
  
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

  const resolveSaleMovementType = (product: any): 'SIMPLE' | 'EXCHANGE' | 'FULL' | null => {
    const raw = String(product?.movement_type ?? product?.movementType ?? '').toUpperCase();
    if (raw === 'EXCHANGE' || raw === 'TROCA') return 'EXCHANGE';
    if (raw === 'FULL' || raw === 'COMPLETA') return 'FULL';
    return 'SIMPLE';
  };

  /** Verifica se o produto permite escolha de modalidade (TROCA/COMPLETA) */
  const productAllowsModeChoice = (product: any): boolean => {
    const raw = String(product?.movement_type ?? product?.movementType ?? '').toUpperCase();
    if (raw === 'EXCHANGE') return true;
    const tipo = String(product?.tipo ?? product?.type ?? '').toUpperCase();
    return tipo === 'VASILHAME_VAZIO' || tipo === 'EMPTY_CONTAINER';
  };

  const resolvePricingMode = (saleMode: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null | undefined) => {
    if (saleMode === 'EXCHANGE') return 'TROCA';
    if (saleMode === 'FULL') return 'COMPLETA';
    return 'SIMPLES';
  };

  const resolveProductPrice = (productId: string, saleMode: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null) => {
    return resolvePrice({
      productId,
      depositId: activeDepositId,
      mode: resolvePricingMode(saleMode),
      rows: pricingRows,
    });
  };

  const resolveUnitPriceForItem = (
    productId: string,
    saleMode: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null,
    depositId: string | null,
    basePrice: number,
    specials: ClientSpecialPriceMap
  ) => {
    const modeKey = (saleMode ?? 'SIMPLE').toUpperCase();
    const resolvedDeposit = depositId ? depositId : 'GLOBAL';
    const depKey = `${productId}:${modeKey}:${resolvedDeposit}`;
    const globalKey = `${productId}:${modeKey}:GLOBAL`;

    if (depKey in specials) {
      return { unitPrice: specials[depKey], priceSource: 'CLIENT_SPECIAL' as const };
    }
    if (globalKey in specials) {
      return { unitPrice: specials[globalKey], priceSource: 'CLIENT_SPECIAL' as const };
    }
    return { unitPrice: basePrice, priceSource: 'AUTO' as const };
  };

  const handleAddItem = async () => {
    const product = productsById.get(selectedProductId);
    if (!product || !selectedDepositId) return;

    // Se produto permite escolha de modalidade, abre modal
    if (productAllowsModeChoice(product)) {
      setPendingProduct(product);
      setShowSaleModeModal(true);
      return;
    }

    const defaultMode = resolveSaleMovementType(product) ?? 'SIMPLE';
    await addItemWithMode(product, defaultMode);
  };

  /** Adiciona item ao carrinho com a modalidade especificada */
  const addItemWithMode = async (product: any, saleMode: 'SIMPLE' | 'EXCHANGE' | 'FULL') => {
    const qty = Math.max(1, Number(quantity) || 1);
    const name = product.nome ?? product.name ?? '';
    const type = isServiceProduct(product) ? 'SERVICO' : product.tipo ?? product.type ?? '';

    const basePrice = resolveProductPrice(product.id, saleMode);
    const resolved = resolveUnitPriceForItem(
      product.id,
      saleMode,
      activeDepositId,
      basePrice,
      activeSpecialPrices
    );

    const existing = items.find((i) => i.produtoId === product.id && i.sale_movement_type === saleMode);
    if (existing) {
      const existingSource =
        existing.priceSource ?? (existing.isManualPrice ? 'MANUAL' : resolved.priceSource);
      const nextUnitPrice =
        existingSource === 'MANUAL' ? existing.precoUnitario : resolved.unitPrice;
      const nextSource = existingSource === 'MANUAL' ? 'MANUAL' : resolved.priceSource;
      const next = items.map((i) =>
        i.id === existing.id
          ? {
              ...i,
              precoUnitario: nextUnitPrice,
              quantidade: i.quantidade + qty,
              priceSource: nextSource,
              isManualPrice: nextSource === 'MANUAL',
            }
          : i
      );
      setItems(next);
      toast.success(`Quantidade de ${name} atualizada para ${existing.quantidade + qty}`);
    } else {
      const modeInfo = SALE_MODE_INFO[saleMode];
      const nextItem: OrderItem = {
        id: crypto.randomUUID(),
        produtoId: product.id,
        nome: name,
        tipo: type,
        precoUnitario: resolved.unitPrice,
        quantidade: qty,
        sale_movement_type: saleMode,
        priceSource: resolved.priceSource,
        isManualPrice: false,
      };
      setItems([...items, nextItem]);
      toast.success(`${modeInfo.emoji} ${name} adicionado (${modeInfo.label})`);
    }

    setQuantity('1');
    setSelectedProductId('');
    setShowSaleModeModal(false);
    setPendingProduct(null);
  };

  useEffect(() => {
    const hasSpecials = Object.keys(activeSpecialPrices).length > 0;
    if (items.length === 0 || (!hasSpecials && pricingRows.length === 0)) return;
    let changed = false;
    const nextItems = items.map((item) => {
      const currentSource =
        item.priceSource ?? (item.isManualPrice ? 'MANUAL' : 'AUTO');
      if (currentSource === 'MANUAL') return item;
      const product = productsById.get(item.produtoId);
      const inferredMode = item.sale_movement_type ?? resolveSaleMovementType(product);
      const basePrice = resolveProductPrice(item.produtoId, inferredMode);
      const resolved = resolveUnitPriceForItem(
        item.produtoId,
        inferredMode,
        activeDepositId,
        basePrice,
        activeSpecialPrices
      );
      if (
        resolved.unitPrice !== item.precoUnitario ||
        resolved.priceSource !== currentSource
      ) {
        changed = true;
        return {
          ...item,
          precoUnitario: resolved.unitPrice,
          priceSource: resolved.priceSource,
          isManualPrice: resolved.priceSource === 'MANUAL',
        };
      }
      return item;
    });
    if (changed) setItems(nextItems);
  }, [
    activeDepositId,
    activeSpecialPrices,
    items,
    pricingRows,
    productsById,
    resolveSaleMovementType,
    resolveProductPrice,
    setItems,
  ]);

  const handleUpdateUnitPrice = (itemId: string, rawValue: string) => {
    const parsed = parseMoneyInput(rawValue);
    const next = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            precoUnitario: parsed,
            priceSource: 'MANUAL',
            isManualPrice: true,
          }
        : item
    );
    setItems(next);
  };

  const handleRevertPrice = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const product = productsById.get(item.produtoId);
    const inferredMode = item.sale_movement_type ?? resolveSaleMovementType(product);
    const basePrice = resolveProductPrice(item.produtoId, inferredMode);
    const resolved = resolveUnitPriceForItem(
      item.produtoId,
      inferredMode,
      activeDepositId,
      basePrice,
      activeSpecialPrices
    );
    const next = items.map((entry) =>
      entry.id === itemId
        ? {
            ...entry,
            precoUnitario: resolved.unitPrice,
            priceSource: resolved.priceSource,
            isManualPrice: false,
          }
        : entry
    );
    setItems(next);
  };

  /** Handler do modal - confirma escolha de modalidade */
  const handleSaleModeConfirm = async (mode: 'EXCHANGE' | 'FULL') => {
    if (!pendingProduct) return;
    await addItemWithMode(pendingProduct, mode);
  };

  /** Handler do modal - cancela */
  const handleSaleModeCancel = () => {
    setPendingProduct(null);
    setShowSaleModeModal(false);
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
      void handleAddItem();
    }
  };

  if (!selectedDepositId) {
    return <div className="text-sm text-gray-600">Selecione um deposito primeiro</div>;
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho com botão de ajuda */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Adicionar Produtos</span>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="text-blue-500 hover:text-blue-700"
            title="Entenda as modalidades de venda"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Formulário de adição */}
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
              .map((p: any) => {
                const allowsChoice = productAllowsModeChoice(p);
                return (
                  <option key={p.id} value={p.id}>
                    {p.nome ?? p.name} {allowsChoice ? '🔄' : ''}
                  </option>
                );
              })}
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
              <th className="px-2 py-2 text-left">Modalidade</th>
              <th className="px-2 py-2 text-left">Preço Unit.</th>
              <th className="px-2 py-2 text-left">Qtd</th>
              <th className="px-2 py-2 text-left">Total</th>
              <th className="px-2 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Nenhum item adicionado. Selecione um produto acima.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isLocked = lockedProductIds?.includes(item.produtoId);
                const product = productsById.get(item.produtoId);
                const inferredMode = item.sale_movement_type ?? resolveSaleMovementType(product);
                const modeKey = (inferredMode || 'SIMPLE') as keyof typeof SALE_MODE_INFO;
                const modeInfo = SALE_MODE_INFO[modeKey] || SALE_MODE_INFO.SIMPLE;
                const basePrice = resolveProductPrice(item.produtoId, inferredMode);
                const resolved = resolveUnitPriceForItem(
                  item.produtoId,
                  inferredMode,
                  activeDepositId,
                  basePrice,
                  activeSpecialPrices
                );
                const currentSource =
                  item.priceSource ?? (item.isManualPrice ? 'MANUAL' : resolved.priceSource);
                const displayUnit =
                  currentSource === 'MANUAL'
                    ? item.precoUnitario
                    : (item.precoUnitario ?? resolved.unitPrice);
                
                return (
                  <tr key={item.id} className="border-t border-gray-200">
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.nome}</span>
                        <span className="text-xs text-gray-500">{item.tipo}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span 
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium ${modeInfo.badgeClass}`}
                        title={modeInfo.detail}
                      >
                        {modeInfo.emoji} {modeInfo.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-medium">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatMoney(displayUnit)}
                          onChange={(e) => handleUpdateUnitPrice(item.id, e.target.value)}
                          disabled={isLocked}
                          className={`w-28 h-7 px-2 border border-gray-300 rounded text-sm ${
                            isLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                          }`}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                          {currentSource === 'CLIENT_SPECIAL' && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                              Preço especial
                            </span>
                          )}
                          {currentSource === 'MANUAL' && (
                            <>
                              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                Manual
                              </span>
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertPrice(item.id)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  Reverter para automático
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
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
                    <td className="px-2 py-2 font-bold text-green-700">
                      R$ {(displayUnit * item.quantidade).toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                        aria-label="Remover item"
                        title="Remover este item"
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

      {/* Modal de Seleção de Modalidade */}
      {showSaleModeModal && pendingProduct && (() => {
        const baseTroca = resolveProductPrice(pendingProduct.id, 'EXCHANGE');
        const baseCompleta = resolveProductPrice(pendingProduct.id, 'FULL');
        const precoTroca = resolveUnitPriceForItem(
          pendingProduct.id,
          'EXCHANGE',
          activeDepositId,
          baseTroca,
          activeSpecialPrices
        );
        const precoCompleta = resolveUnitPriceForItem(
          pendingProduct.id,
          'FULL',
          activeDepositId,
          baseCompleta,
          activeSpecialPrices
        );
        
        return (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6" />
                  <div>
                    <h3 className="font-bold text-lg">Escolha a Modalidade de Venda</h3>
                    <p className="text-orange-100 text-sm">Como será vendido este produto?</p>
                  </div>
                </div>
                <button 
                  onClick={handleSaleModeCancel}
                  className="p-1 hover:bg-white/20 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Produto Info */}
              <div className="px-5 py-4 bg-gray-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{pendingProduct.nome ?? pendingProduct.name}</p>
                    <p className="text-sm text-gray-500">Quantidade: {quantity} unidade(s)</p>
                  </div>
                </div>
              </div>

              {/* Opções */}
              <div className="p-5 space-y-3">
                {/* TROCA */}
                <button
                  onClick={() => handleSaleModeConfirm('EXCHANGE')}
                  className="w-full p-4 rounded-xl border-2 border-green-400 bg-green-50 hover:bg-green-100 hover:border-green-500 transition-all text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <RefreshCw className="w-6 h-6 text-green-700" />
                      </div>
                      <div>
                        <div className="font-bold text-green-800 text-lg flex items-center gap-2">
                          🔁 TROCA
                        </div>
                        <p className="text-green-700 text-sm mt-1">
                          Cliente <strong>devolve</strong> vasilhame vazio
                        </p>
                        <div className="mt-2 text-xs text-green-600 bg-green-100 px-2 py-1 rounded inline-block">
                          📤 Sai: cheio | 📥 Entra: vazio
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-green-700">R$ {precoTroca.unitPrice.toFixed(2)}</div>
                      <div className="text-xs text-green-600">por unidade</div>
                    </div>
                  </div>
                </button>

                {/* COMPLETA */}
                <button
                  onClick={() => handleSaleModeConfirm('FULL')}
                  className="w-full p-4 rounded-xl border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 hover:border-blue-500 transition-all text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Package className="w-6 h-6 text-blue-700" />
                      </div>
                      <div>
                        <div className="font-bold text-blue-800 text-lg flex items-center gap-2">
                          📦 COMPLETA
                        </div>
                        <p className="text-blue-700 text-sm mt-1">
                          Cliente <strong>leva o casco</strong> (novo/sem troca)
                        </p>
                        <div className="mt-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded inline-block">
                          📤 Sai: cheio + casco
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-blue-700">R$ {precoCompleta.unitPrice.toFixed(2)}</div>
                      <div className="text-xs text-blue-600">por unidade</div>
                    </div>
                  </div>
                </button>

                {/* Info */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-700">
                      <strong>Dica:</strong> Escolha TROCA quando o cliente já possui vasilhame e irá devolver.
                      Escolha COMPLETA para clientes novos ou que precisam de um casco adicional.
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-5 py-3 flex justify-end border-t">
                <button
                  onClick={handleSaleModeCancel}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Ajuda */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-6 h-6" />
                <h3 className="font-bold text-lg">Guia de Modalidades de Venda</h3>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-gray-600">
                As modalidades de venda determinam <strong>como o estoque será movimentado</strong> e 
                <strong> qual preço será aplicado</strong> ao produto.
              </p>

              {/* TROCA */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <h4 className="font-bold text-green-800">🔁 TROCA (EXCHANGE)</h4>
                    <p className="text-sm text-green-600">Cliente devolve vasilhame vazio</p>
                  </div>
                </div>
                <ul className="text-sm text-green-700 space-y-1 ml-13 list-disc list-inside">
                  <li><strong>Preço:</strong> Preço de TROCA (geralmente mais barato)</li>
                  <li><strong>Estoque:</strong> SAÍDA do cheio + ENTRADA do vazio</li>
                  <li><strong>Quando usar:</strong> Cliente que já tem vasilhame e vai trocar</li>
                </ul>
              </div>

              {/* COMPLETA */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-800">📦 COMPLETA (FULL)</h4>
                    <p className="text-sm text-blue-600">Cliente leva o casco (cliente novo)</p>
                  </div>
                </div>
                <ul className="text-sm text-blue-700 space-y-1 ml-13 list-disc list-inside">
                  <li><strong>Preço:</strong> Preço COMPLETO (inclui valor do casco)</li>
                  <li><strong>Estoque:</strong> Apenas SAÍDA do cheio</li>
                  <li><strong>Quando usar:</strong> Cliente novo ou que precisa de casco adicional</li>
                </ul>
              </div>

              {/* SIMPLES */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-gray-700" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">🛒 SIMPLES (SIMPLE)</h4>
                    <p className="text-sm text-gray-600">Venda normal sem troca</p>
                  </div>
                </div>
                <ul className="text-sm text-gray-700 space-y-1 ml-13 list-disc list-inside">
                  <li><strong>Preço:</strong> Preço de venda padrão</li>
                  <li><strong>Estoque:</strong> Apenas SAÍDA da quantidade</li>
                  <li><strong>Quando usar:</strong> Produtos que não envolvem troca (água, acessórios)</li>
                </ul>
              </div>

              {/* Dica */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-700">
                    <strong>Identificação na lista:</strong> Produtos com o ícone 🔄 no dropdown 
                    permitem escolher entre TROCA e COMPLETA ao adicionar.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-5 py-3 flex justify-end border-t flex-shrink-0">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
