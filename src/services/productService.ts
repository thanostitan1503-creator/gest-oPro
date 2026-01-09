/**
 * 📦 PRODUCT SERVICE
 * 
 * Camada de serviço para operações com Produtos.
 * Implementa regras de negócio: movement_type, preços por modalidade, vinculação de cascos.
 */

import { supabase } from '@/utils/supabaseClient';
import type { Database } from '@/types/supabase';
import { fromDbProductType, toDbProductType } from '@/utils/productType';
import { resolvePrice, type PricingMode } from '@/utils/pricing';
import { ensurePricingModeMigration, updatePricingModeSupportFromRows } from '@/utils/pricingMigration';

// Atalhos de tipos (schema real)
export type Product = Database['public']['Tables']['products']['Row'];
export type NewProduct = Database['public']['Tables']['products']['Insert'];
export type UpdateProduct = Database['public']['Tables']['products']['Update'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

// Como a precificação agora está na PRÓPRIA tabela products (coluna deposit_id),
// expomos um tipo leve compatível com o consumo atual do front.
export type ProductPricing = {
  product_id: string;
  deposit_id: string | null;
  mode?: PricingMode | null;
  price: number;
  sale_price?: number | null;
  exchange_price?: number | null;
  full_price?: number | null;
};

type ProductPricingInsert = {
  product_id: string;
  deposit_id: string;
  mode?: PricingMode;
  price: number;
};

type PricingPayload = {
  price?: number;
  sale_price?: number | null;
  exchange_price?: number | null;
  full_price?: number | null;
};

const isPricingPayload = (value: unknown): value is PricingPayload => {
  if (!value || typeof value !== 'object') return false;
  return 'price' in value || 'sale_price' in value || 'exchange_price' in value || 'full_price' in value;
};

const normalizePricingMode = (value: unknown): PricingMode => {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'SIMPLE' || raw === 'SIMPLES') return 'SIMPLES';
  if (raw === 'EXCHANGE' || raw === 'TROCA') return 'TROCA';
  if (raw === 'FULL' || raw === 'COMPLETA') return 'COMPLETA';
  return 'SIMPLES';
};

const hasModeColumn = (row: any): boolean =>
  !!row && Object.prototype.hasOwnProperty.call(row, 'mode');

const mapProductRow = (row: Product): Product => ({
  ...row,
  tipo: fromDbProductType((row as any).type ?? (row as any).tipo ?? null) as any,
  type: fromDbProductType((row as any).type ?? (row as any).tipo ?? null) as any,
});

// Normaliza payload vindo do front (camelCase/PT) para colunas do Supabase (snake_case)
const normalizeProductPayload = (input: any): ProductInsert => {
  const payload: ProductInsert = {
    id: input.id,
    code: input.code ?? input.codigo ?? null,
    name: input.name ?? input.nome ?? '',
    description: input.description ?? input.descricao ?? null,
    type: toDbProductType(input.type ?? input.tipo ?? null),
    unit: input.unit ?? input.unidade ?? 'un',
    sale_price: input.sale_price ?? input.preco_venda ?? null,
    exchange_price: input.exchange_price ?? input.preco_troca ?? null,
    full_price: input.full_price ?? input.preco_completa ?? null,
    cost_price: input.cost_price ?? input.preco_custo ?? null,
    movement_type: input.movement_type ?? null,
    return_product_id: input.return_product_id ?? input.returnableId ?? input.linkedProductId ?? null,
    track_stock: input.track_stock ?? input.trackStock ?? input.controls_stock ?? null,
    is_active: input.is_active ?? input.ativo ?? true,
    deposit_id: input.deposit_id ?? input.depositId ?? null,
    product_group: input.product_group ?? input.productGroup ?? null,
    image_url: input.image_url ?? input.imageUrl ?? null,
  };

  return payload;
};

// Versão para updates (só inclui campos presentes)
const normalizeProductUpdate = (updates: any): ProductUpdate => {
  const normalized: ProductUpdate = {};

  if ('id' in updates) normalized.id = updates.id;
  if ('code' in updates || 'codigo' in updates) normalized.code = updates.code ?? updates.codigo ?? null;
  if ('name' in updates || 'nome' in updates) normalized.name = updates.name ?? updates.nome ?? null;
  if ('description' in updates || 'descricao' in updates) normalized.description = updates.description ?? updates.descricao ?? null;
  if ('type' in updates || 'tipo' in updates) {
    normalized.type = toDbProductType(updates.type ?? updates.tipo ?? null);
  }
  if ('unit' in updates || 'unidade' in updates) normalized.unit = updates.unit ?? updates.unidade ?? null;
  if ('sale_price' in updates || 'preco_venda' in updates) normalized.sale_price = updates.sale_price ?? updates.preco_venda ?? null;
  if ('exchange_price' in updates || 'preco_troca' in updates) normalized.exchange_price = updates.exchange_price ?? updates.preco_troca ?? null;
  if ('full_price' in updates || 'preco_completa' in updates) normalized.full_price = updates.full_price ?? updates.preco_completa ?? null;
  if ('cost_price' in updates || 'preco_custo' in updates) normalized.cost_price = updates.cost_price ?? updates.preco_custo ?? null;
  if ('movement_type' in updates) normalized.movement_type = updates.movement_type;
  if ('return_product_id' in updates || 'returnableId' in updates || 'linkedProductId' in updates) {
    normalized.return_product_id = updates.return_product_id ?? updates.returnableId ?? updates.linkedProductId ?? null;
  }
  if ('track_stock' in updates || 'trackStock' in updates || 'controls_stock' in updates) {
    normalized.track_stock = updates.track_stock ?? updates.trackStock ?? updates.controls_stock ?? null;
  }
  if ('is_active' in updates || 'ativo' in updates) normalized.is_active = updates.is_active ?? updates.ativo ?? null;
  if ('deposit_id' in updates || 'depositId' in updates) normalized.deposit_id = updates.deposit_id ?? updates.depositId ?? null;
  if ('product_group' in updates || 'productGroup' in updates) normalized.product_group = updates.product_group ?? updates.productGroup ?? null;
  if ('image_url' in updates || 'imageUrl' in updates) normalized.image_url = updates.image_url ?? updates.imageUrl ?? null;

  return normalized;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export const productService = {
  // 1. Listar todos os produtos ativos (NUNCA clona, nunca duplica)
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw new Error(`Erro ao listar produtos: ${error.message}`);
    // Deduplicar por id (caso algum bug crie duplicata)
    const seen = new Set();
    return (data || []).filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).map(mapProductRow);
  },

  // 2. Listar produtos por depósito (usando deposit_id direto)
  async getByDeposit(depositId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('deposit_id', depositId)
      .order('name');

    if (error) throw new Error(`Erro ao listar produtos do dep¢sito: ${error.message}`);
    return (data || []).map(mapProductRow);
  },

  /**
   * 3. Buscar produto por ID
   */
  async getById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .order('deposit_id', { nullsFirst: true })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar produto: ${error.message}`);
    }
    return data ? mapProductRow(data) : null;
  },

  /**
   * 4. Criar produto
   * 
   * ⚠️ VALIDAÇÕES IMPORTANTES:
   * - Se movement_type = 'EXCHANGE', DEVE ter return_product_id
   * - Se movement_type = 'SIMPLE', return_product_id DEVE ser null
   * - Preços de venda são definidos por depósito na tabela product_pricing
   */
  async create(product: NewProduct): Promise<Product> {
    const payload = normalizeProductPayload(product);

    console.log('[productService.create] payload:', payload);

    // Validação de regras de negócio
    if (payload.movement_type === 'EXCHANGE' && !payload.return_product_id) {
      throw new Error('Produtos com movimento EXCHANGE devem ter produto de retorno vinculado');
    }

    const { data, error } = await supabase
      .from('products')
      .insert([payload]) // Inserir como array
      .select()
      .single();

    if (error) {
      // Erro de FK ao tentar vincular return_product_id inexistente
      if (error.code === '23503' && error.message.includes('return_product_id')) {
        throw new Error('Produto de retorno (vazio) não existe. Crie-o primeiro.');
      }
      throw new Error(`Erro ao criar produto: ${error.message}`);
    }
    return mapProductRow(data);
  },

  /**
   * 5. Atualizar produto
   */
  async update(id: string, updates: UpdateProduct): Promise<Product> {
    const normalized = normalizeProductUpdate(updates);

    const { data, error } = await supabase
      .from('products')
      .update(normalized)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar produto: ${error.message}`);
    return mapProductRow(data);
  },

  /**
   * 6. Desativar produto (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new Error(`Erro ao desativar produto: ${error.message}`);
  },

  /**
   * 7. Buscar produto vazio vinculado (para EXCHANGE)
   * 
   * @example
   * const gasCheio = await productService.getById('uuid-gas-p13');
   * const gasVazio = await productService.getReturnProduct(gasCheio.id);
   */
  async getReturnProduct(productId: string): Promise<Product | null> {
    const product = await this.getById(productId);
    if (!product?.return_product_id) return null;

    return await this.getById(product.return_product_id);
  },

  /**
   * 8. Listar produtos que usam este como retorno
   * (Útil para saber quais produtos "cheios" vinculam a este vazio)
   */
  async getProductsUsingAsReturn(emptyProductId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('return_product_id', emptyProductId)
      .eq('is_active', true);
    
    if (error) throw new Error(`Erro ao buscar produtos vinculados: ${error.message}`);
    return (data || []).map(mapProductRow);
  },

  // ==================== PREÇOS POR DEPÓSITO ====================

  /**
   * 9. Obter preço do produto em um depósito específico
   */
  async getPricing(productId: string, depositId: string, mode: PricingMode = 'SIMPLES'): Promise<ProductPricing | null> {
    const normalizedMode = normalizePricingMode(mode);
    const rows = await this.listPricingByProduct(productId);
    if (!rows || rows.length === 0) return null;

    const sale = resolvePrice({ productId, depositId, mode: 'SIMPLES', rows });
    const exchange = resolvePrice({ productId, depositId, mode: 'TROCA', rows });
    const full = resolvePrice({ productId, depositId, mode: 'COMPLETA', rows });
    const selected = resolvePrice({ productId, depositId, mode: normalizedMode, rows });

    return {
      product_id: productId,
      deposit_id: depositId,
      mode: normalizedMode,
      price: selected,
      sale_price: sale,
      exchange_price: exchange,
      full_price: full,
    };
  },


  /**
    * 10. Definir preço do produto em um depósito
    *
    * Aceita sobrecarga via parâmetros:
    * - `setPricing(productId, depositId, pricing)` para definir preço simples (SIMPLES).
    * - `setPricing(productId, depositId, mode, pricing)` para definir preço específico da modalidade.
    *
    * O primeiro parâmetro de modo (`modeOrPricing`) pode ser um objeto de payload (quando não há modo),
    * ou uma string de modo (SIMPLES, TROCA, COMPLETA), em seguida o payload.
    */
  async setPricing(
    productId: string,
    depositId: string,
    modeOrPricing: PricingMode | PricingPayload,
    maybePricing?: PricingPayload
  ): Promise<ProductPricing> {
    const supportsMode = await ensurePricingModeMigration();
    const pricing = isPricingPayload(modeOrPricing) ? modeOrPricing : maybePricing;
    if (!pricing) {
      throw new Error('Payload de precificação obrigatório');
    }
    const normalizedMode = isPricingPayload(modeOrPricing)
      ? 'SIMPLES'
      : normalizePricingMode(modeOrPricing);
    const priceValue = pricing.price ?? pricing.sale_price ?? 0;

    if (!depositId) {
      const targetColumn =
        normalizedMode === 'TROCA'
          ? 'exchange_price'
          : normalizedMode === 'COMPLETA'
            ? 'full_price'
            : 'sale_price';
      const { data, error } = await supabase
        .from('products')
        .update({ [targetColumn]: priceValue })
        .eq('id', productId)
        .select('sale_price,exchange_price,full_price')
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao gravar precificacao no produto: ${error.message}`);
      }

      const sale = data?.sale_price ?? 0;
      const exchange = data?.exchange_price ?? 0;
      const full = data?.full_price ?? 0;
      const selected =
        normalizedMode === 'TROCA'
          ? exchange
          : normalizedMode === 'COMPLETA'
            ? full
            : sale;

      return {
        product_id: productId,
        deposit_id: null,
        mode: normalizedMode,
        price: selected ?? priceValue,
        sale_price: sale,
        exchange_price: exchange,
        full_price: full,
      };
    }

    if (supportsMode) {
      const pricingPayload = {
        product_id: productId,
        deposit_id: depositId,
        mode: normalizedMode,
        price: priceValue,
      };

      const { error: upsertError } = await supabase
        .from('product_pricing')
        .upsert(pricingPayload, { onConflict: 'product_id,deposit_id,mode' });

      if (upsertError) throw new Error(`Erro ao gravar precificacao no deposito: ${upsertError.message}`);

      const result = await this.getPricing(productId, depositId, normalizedMode);
      if (result) return result;
      const sale = normalizedMode === 'SIMPLES' ? priceValue : 0;
      const exchange = normalizedMode === 'TROCA' ? priceValue : 0;
      const full = normalizedMode === 'COMPLETA' ? priceValue : 0;
      const selected =
        normalizedMode === 'TROCA'
          ? exchange
          : normalizedMode === 'COMPLETA'
            ? full
            : sale;
      return {
        product_id: productId,
        deposit_id: depositId,
        mode: normalizedMode,
        price: selected,
        sale_price: sale,
        exchange_price: exchange,
        full_price: full,
      };
    }

    const targetColumn =
      normalizedMode === 'TROCA'
        ? 'exchange_price'
        : normalizedMode === 'COMPLETA'
          ? 'full_price'
          : 'price';

    const { data: updated, error: updateError } = await supabase
      .from('product_pricing')
      .update({ [targetColumn]: priceValue })
      .eq('product_id', productId)
      .eq('deposit_id', depositId)
      .select('product_id, deposit_id, price, exchange_price, full_price');

    if (updateError) {
      throw new Error(`Erro ao gravar precificacao no deposito: ${updateError.message}`);
    }

    let row = updated?.[0] ?? null;

    if (!row) {
      const insertPayload: any = {
        product_id: productId,
        deposit_id: depositId,
        price: targetColumn === 'price' ? priceValue : 0,
        exchange_price: null,
        full_price: null,
      };
      insertPayload[targetColumn] = priceValue;
      const { data: inserted, error: insertError } = await supabase
        .from('product_pricing')
        .insert(insertPayload)
        .select('product_id, deposit_id, price, exchange_price, full_price');

      if (insertError) {
        throw new Error(`Erro ao gravar precificacao no deposito: ${insertError.message}`);
      }

      row = inserted?.[0] ?? null;
    }

    updatePricingModeSupportFromRows(row ? [row] : []);

    const sale = Number(row?.price ?? 0);
    const exchange = Number(row?.exchange_price ?? 0);
    const full = Number(row?.full_price ?? 0);
    const selected =
      normalizedMode === 'TROCA'
        ? exchange
        : normalizedMode === 'COMPLETA'
          ? full
          : sale;

    return {
      product_id: productId,
      deposit_id: depositId,
      mode: normalizedMode,
      price: selected,
      sale_price: sale,
      exchange_price: exchange,
      full_price: full,
    };
  },

  /**
   * 11. Obter preço final considerando modalidade de venda
   * 
   * Lógica:
   * 1. Busca preço específico do depósito (product_pricing.price)
   * 2. Fallback: usa preço do produto baseado na modalidade
   *    - EXCHANGE → preco_troca/exchange_price
   *    - FULL → preco_completa/full_price  
   *    - SIMPLE → preco_venda/sale_price
   */
  async getFinalPrice(
    productId: string,
    depositId: string,
    saleMovementType: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null
  ): Promise<number> {
    const rows = await this.listPricingByProduct(productId);
    const mode = normalizePricingMode(saleMovementType);
    return resolvePrice({ productId, depositId, mode, rows });
  },

  /**
   * 12. Listar todas as precificações ativas de um produto (por depósito)
   */
  async listPricingByProduct(productId: string): Promise<ProductPricing[]> {
    const supportsMode = await ensurePricingModeMigration();
    const { data, error } = await supabase
      .from('product_pricing')
      .select('*')
      .eq('product_id', productId);

    if (error) throw new Error(`Erro ao listar precos do produto: ${error.message}`);

    updatePricingModeSupportFromRows(data);
    const useMode = (data && data.length > 0 && hasModeColumn(data[0])) || supportsMode;

    if (useMode) {
      return (data || []).map(row => ({
        product_id: row.product_id,
        deposit_id: row.deposit_id,
        mode: normalizePricingMode((row as any).mode ?? 'SIMPLES'),
        price: row.price ?? 0,
        sale_price: row.price ?? null,
        exchange_price: null,
        full_price: null,
      }));
    }

    return (data || []).map(row => ({
      product_id: row.product_id,
      deposit_id: row.deposit_id,
      mode: null as any,
      price: row.price ?? 0,
      sale_price: row.price ?? null,
      exchange_price: row.exchange_price ?? null,
      full_price: row.full_price ?? null,
    }));
  },

  /**
   * 13. Remover (apagar) precificação específica de um depósito
   */
  async removePricing(productId: string, depositId: string, mode?: PricingMode): Promise<void> {
    const supportsMode = await ensurePricingModeMigration();
    if (supportsMode) {
      let query = supabase
        .from('product_pricing')
        .delete()
        .eq('product_id', productId)
        .eq('deposit_id', depositId);
      if (mode) {
        query = query.eq('mode', normalizePricingMode(mode));
      }
      const { error } = await query;

      if (error) throw new Error(`Erro ao remover precificacao do deposito: ${error.message}`);
      return;
    }

    if (!mode) {
      const { error } = await supabase
        .from('product_pricing')
        .delete()
        .eq('product_id', productId)
        .eq('deposit_id', depositId);
      if (error) throw new Error(`Erro ao remover precificacao do deposito: ${error.message}`);
      return;
    }

    const targetColumn =
      normalizePricingMode(mode) === 'TROCA'
        ? 'exchange_price'
        : normalizePricingMode(mode) === 'COMPLETA'
          ? 'full_price'
          : 'price';
    const { error } = await supabase
      .from('product_pricing')
      .update({ [targetColumn]: 0 })
      .eq('product_id', productId)
      .eq('deposit_id', depositId);

    if (error) throw new Error(`Erro ao remover precificacao do deposito: ${error.message}`);
  },

  // ==================== FILTROS E BUSCAS ====================

  /**
   * 12. Buscar produtos por tipo
   */
  async getByType(type: Product['type']): Promise<Product[]> {
    const dbType = toDbProductType(type);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('type', dbType ?? type)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao buscar produtos por tipo: ${error.message}`);
    return (data || []).map(mapProductRow);
  },

  /**
   * 13. Buscar produtos que controlam estoque
   */
  async getStockTracked(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('track_stock', true)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao buscar produtos rastreados: ${error.message}`);
    return (data || []).map(mapProductRow);
  },

  /**
   * 14. Buscar produtos EXCHANGE (com troca de casco)
   */
  async getExchangeProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('movement_type', 'EXCHANGE')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao buscar produtos EXCHANGE: ${error.message}`);
    return (data || []).map(mapProductRow);
  },

  /**
   * Funções auxiliares para manipulação direta com validação de tipos
   */
  async createProduct(product: ProductInsert) {
    const validatedProduct = normalizeProductPayload(product);
    console.log('[productService.createProduct] payload:', validatedProduct);
    const { data, error } = await supabase.from('products').insert([validatedProduct]);
    if (error) throw error;
    return Array.isArray(data) ? data.map(mapProductRow) : data;
  },

  async updateProduct(id: string, updates: ProductUpdate) {
    const validatedUpdates = normalizeProductUpdate(updates);
    const { data, error } = await supabase.from('products').update(validatedUpdates).eq('id', id);
    if (error) throw error;
    return Array.isArray(data) ? data.map(mapProductRow) : data;
  },

  async deactivateProduct(id: string) {
    const { data, error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    return Array.isArray(data) ? data.map(mapProductRow) : data;
  },

  async upsertProductPricing(pricing: ProductPricingInsert) {
    // Compatibilidade: mantém assinatura, mas usa tabela products + deposit_id
    const mode = pricing.mode ?? 'SIMPLES';
    return await this.setPricing(pricing.product_id, pricing.deposit_id, mode, { price: pricing.price });
  }
};
