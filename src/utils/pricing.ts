import type { PricingMode } from '@/domain/types';
export type { PricingMode } from '@/domain/types';

export type PricingRow = {
  id?: string;
  product_id: string;
  deposit_id?: string | null;
  mode?: PricingMode | null;
  price: number;
  exchange_price?: number | null;
  full_price?: number | null;
  sale_price?: number | null;
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

const getLegacyPriceForMode = (row: PricingRow, mode: PricingMode): number | null => {
  const target = normalizeMode(mode);
  if (target === 'TROCA') return coerceNumber(row.exchange_price);
  if (target === 'COMPLETA') return coerceNumber(row.full_price);
  return coerceNumber(row.price ?? row.sale_price);
};

const getRowPriceForMode = (row: PricingRow, mode: PricingMode): number | null => {
  const modeValue = row.mode ?? null;
  const hasLegacyPrices = row.exchange_price !== null && row.exchange_price !== undefined
    || row.full_price !== null && row.full_price !== undefined;
  if (
    hasLegacyPrices &&
    (modeValue === null || modeValue === undefined || String(modeValue).trim() === '' || normalizeMode(modeValue) === 'SIMPLES')
  ) {
    return getLegacyPriceForMode(row, mode);
  }
  if (modeValue !== null && modeValue !== undefined && String(modeValue).trim() !== '') {
    if (normalizeMode(modeValue) !== normalizeMode(mode)) return null;
    return coerceNumber(row.price);
  }
  return getLegacyPriceForMode(row, mode);
};

const findFirstPrice = (rows: PricingRow[], mode: PricingMode): number | null => {
  for (const row of rows) {
    const candidate = getRowPriceForMode(row, mode);
    if (candidate !== null) return candidate;
  }
  return null;
};

const findMinPrice = (rows: PricingRow[], mode: PricingMode): number | null => {
  let min: number | null = null;
  for (const row of rows) {
    const candidate = getRowPriceForMode(row, mode);
    if (candidate === null) continue;
    if (min === null || candidate < min) min = candidate;
  }
  return min;
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
        row.product_id === productId && (row.deposit_id ?? null) === normalizedDepositId
    );
    const exactPrice = findFirstPrice(depositRows, targetMode);
    if (exactPrice !== null) return exactPrice;
    if (targetMode !== 'SIMPLES') {
      const fallbackPrice = findFirstPrice(depositRows, 'SIMPLES');
      if (fallbackPrice !== null) return fallbackPrice;
    }
  }

  const productRows = rows.filter((row) => row.product_id === productId);
  let minPrice = findMinPrice(productRows, targetMode);

  if (minPrice === null && targetMode !== 'SIMPLES') {
    minPrice = findMinPrice(productRows, 'SIMPLES');
  }

  return minPrice ?? 0;
}
