import { supabase } from '@/utils/supabaseClient';
import type { PricingMode } from '@/domain/types';

let pricingModeMigrated = false;
let pricingModeSupported: boolean | null = null;

const normalizeMode = (value: unknown): PricingMode => {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'TROCA' || raw === 'EXCHANGE') return 'TROCA';
  if (raw === 'COMPLETA' || raw === 'FULL') return 'COMPLETA';
  return 'SIMPLES';
};

const buildKey = (productId: string, depositId: string, mode: PricingMode) =>
  `${productId}::${depositId}::${mode}`;

const hasModeColumn = (row: any): boolean =>
  !!row && Object.prototype.hasOwnProperty.call(row, 'mode');

export const updatePricingModeSupportFromRows = (rows?: any[] | null): boolean | null => {
  if (!rows || rows.length === 0) return pricingModeSupported;
  pricingModeSupported = hasModeColumn(rows[0]);
  return pricingModeSupported;
};

export const getPricingModeSupport = async (): Promise<boolean> => {
  if (pricingModeSupported !== null) return pricingModeSupported;
  try {
    const { error } = await supabase.from('product_pricing').select('mode').limit(1);
    if (!error) {
      pricingModeSupported = true;
      return true;
    }

    const msg = String(error?.message ?? '').toLowerCase();
    if (msg.includes('column') && msg.includes('mode')) {
      pricingModeSupported = false;
      return false;
    }

    console.warn('Nao foi possivel verificar suporte a modalidade de preco:', error);
    pricingModeSupported = false;
    return false;
  } catch (err) {
    console.warn('Nao foi possivel verificar suporte a modalidade de preco:', err);
    pricingModeSupported = false;
    return false;
  }
};

export const ensurePricingModeMigration = async (): Promise<boolean> => {
  if (pricingModeMigrated) return pricingModeSupported ?? false;
  const supportsMode = await getPricingModeSupport();
  if (!supportsMode) {
    pricingModeMigrated = true;
    return false;
  }

  try {
    const { error: modeError } = await supabase
      .from('product_pricing')
      .update({ mode: 'SIMPLES' })
      .is('mode', null);
    if (modeError) throw modeError;

    let rows: any[] = [];
    const { data, error } = await supabase
      .from('product_pricing')
      .select('id, product_id, deposit_id, mode, price, exchange_price, full_price');
    if (error) {
      const fallback = await supabase
        .from('product_pricing')
        .select('id, product_id, deposit_id, mode, price');
      if (fallback.error) throw fallback.error;
      rows = fallback.data || [];
    } else {
      rows = data || [];
    }

    updatePricingModeSupportFromRows(rows);

    if (rows.length > 0) {
      const existing = new Set<string>();
      rows.forEach((row) => {
        const productId = row.product_id;
        const depositId = row.deposit_id;
        if (!productId || !depositId) return;
        const mode = normalizeMode(row.mode ?? 'SIMPLES');
        existing.add(buildKey(productId, depositId, mode));
      });

      const inserts: Array<{ product_id: string; deposit_id: string; mode: PricingMode; price: number }> = [];
      rows.forEach((row) => {
        const productId = row.product_id;
        const depositId = row.deposit_id;
        if (!productId || !depositId) return;

        const exchange = Number(row.exchange_price);
        if (Number.isFinite(exchange) && exchange > 0) {
          const key = buildKey(productId, depositId, 'TROCA');
          if (!existing.has(key)) {
            existing.add(key);
            inserts.push({
              product_id: productId,
              deposit_id: depositId,
              mode: 'TROCA',
              price: exchange,
            });
          }
        }

        const full = Number(row.full_price);
        if (Number.isFinite(full) && full > 0) {
          const key = buildKey(productId, depositId, 'COMPLETA');
          if (!existing.has(key)) {
            existing.add(key);
            inserts.push({
              product_id: productId,
              deposit_id: depositId,
              mode: 'COMPLETA',
              price: full,
            });
          }
        }
      });

      if (inserts.length > 0) {
        const { error: upsertError } = await supabase
          .from('product_pricing')
          .upsert(inserts, { onConflict: 'product_id,deposit_id,mode' });
        if (upsertError) throw upsertError;
      }
    }
  } catch (err) {
    console.warn('Nao foi possivel migrar precos por modalidade:', err);
  } finally {
    pricingModeMigrated = true;
  }

  return pricingModeSupported ?? false;
};
