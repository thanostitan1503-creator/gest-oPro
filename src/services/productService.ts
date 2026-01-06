/**
 * 📦 PRODUCT SERVICE
 * 
 * Camada de serviço para operações com Produtos.
 * Implementa regras de negócio: movement_type, preços por modalidade, vinculação de cascos.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Atalhos de tipos
export type Product = Database['public']['Tables']['products']['Row'];
export type NewProduct = Database['public']['Tables']['products']['Insert'];
export type UpdateProduct = Database['public']['Tables']['products']['Update'];
export type ProductPricing = Database['public']['Tables']['product_pricing']['Row'];

/**
 * Service Pattern para Products
 */
export const productService = {
  /**
   * 1. Listar todos os produtos ativos
   */
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao listar produtos: ${error.message}`);
    return data || [];
  },

  /**
   * 2. Listar produtos por depósito (com preços específicos)
   */
  async getByDeposit(depositId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_pricing!inner(
          sale_price,
          exchange_price,
          full_price
        )
      `)
      .eq('is_active', true)
      .eq('product_pricing.deposit_id', depositId)
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
      .single();
    
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
   * - Se movement_type = 'EXCHANGE', DEVE ter exchange_price e full_price
   * - Se movement_type = 'SIMPLE', return_product_id DEVE ser null
   */
  async create(product: NewProduct): Promise<Product> {
    // Validação de regras de negócio
    if (product.movement_type === 'EXCHANGE') {
      if (!product.return_product_id) {
        throw new Error('Produtos com movimento EXCHANGE devem ter produto de retorno vinculado');
      }
      if (!product.exchange_price || !product.full_price) {
        throw new Error('Produtos com movimento EXCHANGE devem ter exchange_price e full_price');
      }
    }

    const { data, error } = await supabase
      .from('products')
      .insert(product)
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
    const { data, error } = await supabase
      .from('products')
      .update(updates)
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
    const { data, error } = await supabase
      .from('product_pricing')
      .select('*')
      .eq('product_id', productId)
      .eq('deposit_id', depositId)
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar preço: ${error.message}`);
    }
    return data;
  },

  /**
   * 10. Definir preço do produto em um depósito
   */
  async setPricing(
    productId: string,
    depositId: string,
    pricing: {
      sale_price: number;
      exchange_price?: number | null;
      full_price?: number | null;
    }
  ): Promise<ProductPricing> {
    // Upsert (insert ou update se já existir)
    const { data, error } = await supabase
      .from('product_pricing')
      .upsert({
        product_id: productId,
        deposit_id: depositId,
        ...pricing,
        is_active: true
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao definir preço: ${error.message}`);
    return data;
  },

  /**
   * 11. Obter preço final considerando modalidade de venda
   * 
   * Lógica:
   * - Se sale_movement_type = 'EXCHANGE' → usa exchange_price
   * - Se sale_movement_type = 'FULL' → usa full_price
   * - Se sale_movement_type = 'SIMPLE' ou null → usa sale_price
   */
  async getFinalPrice(
    productId: string,
    depositId: string,
    saleMovementType: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null
  ): Promise<number> {
    const pricing = await this.getPricing(productId, depositId);
    
    if (!pricing) {
      // Fallback: buscar preço do produto (campo sale_price)
      const product = await this.getById(productId);
      if (!product) throw new Error('Produto não encontrado');
      return product.sale_price;
    }

    // Seleciona preço baseado na modalidade
    switch (saleMovementType) {
      case 'EXCHANGE':
        return pricing.exchange_price || pricing.sale_price;
      case 'FULL':
        return pricing.full_price || pricing.sale_price;
      default:
        return pricing.sale_price;
    }
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
  }
};
