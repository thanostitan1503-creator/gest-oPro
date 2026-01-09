import type { PricingMode } from '@/domain/types';
export type { PricingMode } from '@/domain/types';

export type PricingRow = {
  id?: string;
  product_id?: string | null;
  productId?: string | null;
  deposit_id?: string | null;
  depositId?: string | null;
  depositoId?: string | null;
  mode?: PricingMode | string | null;
  price?: number | null;
  value?: number | null;
  exchange_price?: number | null;
  full_price?: number | null;
  exchangePrice?: number | null;
  fullPrice?: number | null;
};

const normalizeMode = (value: unknown): PricingMode => {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'TROCA' || raw === 'EXCHANGE') return 'TROCA';
  if (raw === 'COMPLETA' || raw === 'FULL') return 'COMPLETA';
  if (raw === 'SIMPLE' || raw === 'SIMPLES') return 'SIMPLES';
  return 'SIMPLES';
};

const coerceNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getProductId = (row: PricingRow): string | null =>
  row.product_id ?? row.productId ?? null;

const getDepositId = (row: PricingRow): string | null =>
  row.deposit_id ?? row.depositoId ?? row.depositId ?? null;

const getPriceForMode = (row: PricingRow, mode: PricingMode): number | null => {
  const normalizedMode = normalizeMode(mode);
  const rowMode = normalizeMode(row.mode);
  const basePrice = coerceNumber(row.price ?? row.value);
  const exchangePrice = coerceNumber(row.exchange_price ?? row.exchangePrice);
  const fullPrice = coerceNumber(row.full_price ?? row.fullPrice);

  if (normalizedMode === 'SIMPLES') return basePrice;
  if (normalizedMode === 'TROCA') {
    if (exchangePrice !== null) return exchangePrice;
    return rowMode === 'TROCA' ? basePrice : null;
  }
  if (normalizedMode === 'COMPLETA') {
    if (fullPrice !== null) return fullPrice;
    return rowMode === 'COMPLETA' ? basePrice : null;
  }
  return basePrice;
};

const findMinPrice = (rows: PricingRow[], mode: PricingMode): number | null => {
  let min: number | null = null;
  for (const row of rows) {
    const candidate = getPriceForMode(row, mode);
    if (candidate === null) continue;
    if (min === null || candidate < min) min = candidate;
  }
  return min;
};

const findFirstPrice = (rows: PricingRow[], mode: PricingMode): number | null => {
  for (const row of rows) {
    const candidate = getPriceForMode(row, mode);
    if (candidate !== null) return candidate;
  }
  return null;
};

export function resolvePrice(args: {
  productId: string;
  depositId?: string | null;
  mode: PricingMode;
  rows: PricingRow[];
}): number {
  const { productId, depositId, mode, rows } = args;
  if (!productId || !rows || rows.length === 0) return 0;

  const normalizedDepositId = depositId ?? null;
  const targetMode = normalizeMode(mode);

  if (normalizedDepositId) {
    const depositRows = rows.filter(
      (row) =>
        getProductId(row) === productId && getDepositId(row) === normalizedDepositId
    );
    const exactPrice = findFirstPrice(depositRows, targetMode);
    if (exactPrice !== null) return exactPrice;
    if (targetMode !== 'SIMPLES') {
      const fallbackPrice = findFirstPrice(depositRows, 'SIMPLES');
      if (fallbackPrice !== null) return fallbackPrice;
    }
  }

  const productRows = rows.filter((row) => getProductId(row) === productId);
  let minPrice = findMinPrice(productRows, targetMode);

  if (minPrice === null && targetMode !== 'SIMPLES') {
    minPrice = findMinPrice(productRows, 'SIMPLES');
  }

  return minPrice ?? 0;
}
