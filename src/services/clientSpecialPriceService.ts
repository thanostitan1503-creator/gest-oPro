import { listClientPriceOverrides } from './clientPricingService';
import type { ClientPriceOverrideRow } from './clientPricingService';

export type ClientSpecialPriceMap = Record<string, number>;

const normalizeMode = (value?: string | null) => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'SIMPLES') return 'SIMPLE';
  if (raw === 'TROCA') return 'EXCHANGE';
  if (raw === 'COMPLETA') return 'FULL';
  if (!raw) return 'SIMPLE';
  return raw;
};

const resolvePriceValue = (row: ClientPriceOverrideRow) => {
  const raw = row.special_price ?? row.override_price;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const buildSpecialPriceKey = (
  productId: string,
  mode: string,
  depositId?: string | null
) => {
  return `${productId}:${mode}:${depositId ?? 'GLOBAL'}`;
};

export async function loadClientSpecialPrices(
  clientId: string
): Promise<ClientSpecialPriceMap> {
  const rows = await listClientPriceOverrides(clientId);
  const map: ClientSpecialPriceMap = {};

  rows.forEach((row) => {
    if (row.is_active === false) return;
    const value = resolvePriceValue(row);
    if (value === null) return;
    const mode = normalizeMode(row.modality);
    const key = buildSpecialPriceKey(row.product_id, mode, row.deposit_id);
    map[key] = value;
  });

  return map;
}
