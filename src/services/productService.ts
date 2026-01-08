/**
 * 📦 PRODUCT SERVICE
 * 
 * Camada de serviço para operações com Produtos.
 * Implementa regras de negócio: movement_type, preços por modalidade, vinculação de cascos.
 */

import { supabase } from '@/utils/supabaseClient';
import type { Database } from '@/types/supabase';

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
  price: number; // mapeia para sale_price
  sale_price?: number | null;
  exchange_price?: number | null;
  full_price?: number | null;
};

type ProductPricingInsert = {
  product_id: string;
  deposit_id: string;
  price: number;
};

// Normaliza payload vindo do front (camelCase/PT) para colunas do Supabase (snake_case)
const normalizeProductPayload = (input: any): ProductInsert => {
  const payload: ProductInsert = {
    id: input.id,
    code: input.code ?? input.codigo ?? null,
    name: input.name ?? input.nome ?? '',
    description: input.description ?? input.descricao ?? null,
    type: input.type ?? input.tipo ?? null,
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
  if ('type' in updates || 'tipo' in updates) normalized.type = updates.type ?? updates.tipo ?? null;
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
    });
  },

  // 2. Listar produtos por depósito (usando deposit_id direto)
  async getByDeposit(depositId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('deposit_id', depositId)
      .order('name');

    if (error) throw new Error(`Erro ao listar produtos do depósito: ${error.message}`);
    return data || [];
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
    return data;
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
    return data;
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
    return data;
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
    return data || [];
  },

  // ==================== PREÇOS POR DEPÓSITO ====================

  /**
   * 9. Obter preço do produto em um depósito específico
   */
  async getPricing(productId: string, depositId: string): Promise<ProductPricing | null> {
    // Preço por depósito agora é armazenado na tabela product_pricing
    const { data, error } = await supabase
      .from('product_pricing')
      .select('product_id, deposit_id, price, exchange_price, full_price')
      .eq('product_id', productId)
      .eq('deposit_id', depositId)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar preço: ${error.message}`);
    }

    if (!data) return null;

    return {
      product_id: data.product_id,
      deposit_id: data.deposit_id,
      price: data.price ?? 0,
      sale_price: data.price ?? null,
      exchange_price: data.exchange_price ?? null,
      full_price: data.full_price ?? null,
    };
  },

  /**
   * 10. Definir preço do produto em um depósito
   */
  async setPricing(
    productId: string,
    depositId: string,
    pricing: {
      price?: number;
      sale_price?: number | null;
      exchange_price?: number | null;
      full_price?: number | null;
    }
  ): Promise<ProductPricing> {
    const buildPriceUpdates = (payload: typeof pricing): ProductUpdate => {
      const updates: ProductUpdate = {};

      if ('sale_price' in payload || 'price' in payload) {
        updates.sale_price = payload.sale_price ?? payload.price ?? null;
      }
      if ('exchange_price' in payload) {
        updates.exchange_price = payload.exchange_price ?? null;
      }
      if ('full_price' in payload) {
        updates.full_price = payload.full_price ?? null;
      }

      return updates;
    };

    // 1. Buscar o produto original pelo ID
    const { data: originalProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !originalProduct) {
      throw new Error('Produto original não encontrado para precificação');
    }

    // Se não há depósito (contexto global), atualiza o próprio produto
    if (!depositId) {
      const updates = buildPriceUpdates(pricing);
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select('id, deposit_id, sale_price, exchange_price, full_price')
        .single();

      if (error) throw new Error(`Erro ao atualizar preço global: ${error.message}`);

      return {
        product_id: data.id,
        deposit_id: data.deposit_id,
        price: data.sale_price ?? 0,
        sale_price: data.sale_price,
        exchange_price: data.exchange_price,
        full_price: data.full_price,
      };
    }

    // NUNCA clonar produtos por depósito! Só product_pricing faz upsert.
    const updates = buildPriceUpdates(pricing);

    // Upsert na tabela product_pricing (product_id + deposit_id é a key)
    const pricingPayload: any = {
      product_id: productId,
      deposit_id: depositId,
      price: updates.sale_price ?? updates.price ?? null,
      exchange_price: updates.exchange_price ?? null,
      full_price: updates.full_price ?? null,
    };

    // Tentar upsert (PostgREST upsert via .upsert)
    const { data: upserted, error: upsertError } = await supabase
      .from('product_pricing')
      .upsert(pricingPayload, { onConflict: ['product_id', 'deposit_id'] })
      .select()
      .single();

    if (upsertError) throw new Error(`Erro ao gravar precificação no depósito: ${upsertError.message}`);

    return {
      product_id: upserted.product_id,
      deposit_id: upserted.deposit_id,
      price: upserted.price ?? 0,
      sale_price: upserted.price ?? upserted.sale_price ?? null,
      exchange_price: upserted.exchange_price ?? null,
      full_price: upserted.full_price ?? null,
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
    const { data: depRow, error: depError } = await supabase
      .from('products')
      .select('sale_price, exchange_price, full_price, id')
      .eq('id', productId)
      .eq('deposit_id', depositId)
      .limit(1)
      .maybeSingle();

    if (depError && depError.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar preço do depósito: ${depError.message}`);
    }

    const baseProduct = depRow ? depRow : await this.getById(productId);
    if (!baseProduct) throw new Error('Produto não encontrado');

    switch (saleMovementType) {
      case 'EXCHANGE':
        return (baseProduct as any).exchange_price ?? (baseProduct as any).sale_price ?? 0;
      case 'FULL':
        return (baseProduct as any).full_price ?? (baseProduct as any).sale_price ?? 0;
      default:
        return (baseProduct as any).sale_price ?? 0;
    }
  },

  /**
   * 12. Listar todas as precificações ativas de um produto (por depósito)
   */
  async listPricingByProduct(productId: string): Promise<ProductPricing[]> {
    const { data, error } = await supabase
      .from('product_pricing')
      .select('product_id, deposit_id, price, exchange_price, full_price')
      .eq('product_id', productId);

    if (error) throw new Error(`Erro ao listar preços do produto: ${error.message}`);

    return (data || []).map(row => ({
      product_id: row.product_id,
      deposit_id: row.deposit_id,
      price: row.price ?? 0,
      sale_price: row.price ?? null,
      exchange_price: row.exchange_price ?? null,
      full_price: row.full_price ?? null,
    }));
  },

  /**
   * 13. Remover (apagar) precificação específica de um depósito
   */
  async removePricing(productId: string, depositId: string): Promise<void> {
    const { error } = await supabase
      .from('product_pricing')
      .delete()
      .eq('product_id', productId)
      .eq('deposit_id', depositId);

    if (error) throw new Error(`Erro ao remover precificação do depósito: ${error.message}`);
  },

  // ==================== FILTROS E BUSCAS ====================

  /**
   * 12. Buscar produtos por tipo
   */
  async getByType(type: Product['type']): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao buscar produtos por tipo: ${error.message}`);
    return data || [];
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
    return data || [];
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
    return data || [];
  },

  /**
   * Funções auxiliares para manipulação direta com validação de tipos
   */
  async createProduct(product: ProductInsert) {
    const validatedProduct = normalizeProductPayload(product);
    console.log('[productService.createProduct] payload:', validatedProduct);
    const { data, error } = await supabase.from('products').insert([validatedProduct]);
    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, updates: ProductUpdate) {
    const validatedUpdates = normalizeProductUpdate(updates);
    const { data, error } = await supabase.from('products').update(validatedUpdates).eq('id', id);
    if (error) throw error;
    return data;
  },

  async deactivateProduct(id: string) {
    const { data, error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    return data;
  },

  async upsertProductPricing(pricing: ProductPricingInsert) {
    // Compatibilidade: mantém assinatura, mas usa tabela products + deposit_id
    return await this.setPricing(pricing.product_id, pricing.deposit_id, { sale_price: pricing.price });
  }
};
