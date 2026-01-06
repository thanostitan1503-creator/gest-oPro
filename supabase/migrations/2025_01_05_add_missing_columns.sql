-- Migração: Adicionar colunas faltantes
-- Data: 05/01/2026
-- Descrição: Adiciona colunas necessárias para suportar:
--   - Carga inicial de estoque
--   - Movimentação de estoque com motivo
--   - Preços por modalidade (TROCA/COMPLETA)
--   - Modo de venda no item da O.S.

-- ============================================================
-- TABELA: stock_movements
-- ============================================================

-- Adicionar coluna 'reason' (motivo da movimentação)
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'Ajuste Manual';

-- Adicionar coluna 'origin' (origem/tipo original do movimento)
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT NULL;

-- Adicionar coluna 'type' se não existir (IN/OUT)
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'IN';

-- Adicionar coluna 'quantity' se não existir  
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;

-- Adicionar coluna 'product_id' se não existir
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS product_id UUID;

-- Adicionar coluna 'deposit_id' se não existir
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS deposit_id UUID;

-- Adicionar coluna 'user_id' se não existir
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Adicionar coluna 'user_name' se não existir
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Adicionar coluna 'reference_id' se não existir
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS reference_id UUID;

COMMENT ON COLUMN public.stock_movements.reason IS 
  'Motivo da movimentação: Carga inicial, Sobra/Falta na contagem, Venda, etc.';

COMMENT ON COLUMN public.stock_movements.origin IS 
  'Tipo original do movimento: CARGA_INICIAL, AJUSTE_CONTAGEM, ENTRADA, SAIDA, etc.';

-- ============================================================
-- TABELA: products
-- ============================================================

-- Adicionar colunas para compatibilidade (PT e EN)
-- O sistema usa 'ativo' mas alguns schemas usam 'active' ou 'is_active'

-- Coluna ativo (PT - padrão do sistema)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Coluna active (EN - para compatibilidade)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Coluna is_active (alternativa EN)  
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Adicionar coluna 'name' se só existir 'nome'
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Sincronizar valores entre colunas de nome
UPDATE public.products SET name = nome WHERE name IS NULL AND nome IS NOT NULL;
UPDATE public.products SET nome = name WHERE nome IS NULL AND name IS NOT NULL;

-- Sincronizar valores entre colunas de ativo
UPDATE public.products SET active = ativo WHERE active IS NULL AND ativo IS NOT NULL;
UPDATE public.products SET is_active = ativo WHERE is_active IS NULL AND ativo IS NOT NULL;
UPDATE public.products SET ativo = COALESCE(active, is_active, true) WHERE ativo IS NULL;

-- Adicionar coluna 'preco_troca' (preço quando cliente devolve casco)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS preco_troca NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.products.preco_troca IS 
  'Preço quando modalidade TROCA (cliente devolve casco vazio)';

-- Adicionar coluna 'preco_completa' (preço quando cliente leva casco)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS preco_completa NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.products.preco_completa IS 
  'Preço quando modalidade COMPLETA (cliente leva o casco)';

-- Adicionar coluna 'movement_type' (tipo de movimento de estoque)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'SIMPLE';

COMMENT ON COLUMN public.products.movement_type IS 
  'Tipo de movimento: SIMPLE (venda simples), EXCHANGE (troca), FULL (venda completa)';

-- Adicionar coluna 'return_product_id' (vínculo com produto vazio)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS return_product_id UUID;

COMMENT ON COLUMN public.products.return_product_id IS 
  'ID do produto vazio vinculado (para produtos com movement_type=EXCHANGE)';

-- Adicionar coluna 'track_stock' 
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT true;

-- Adicionar coluna 'is_delivery_fee'
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS is_delivery_fee BOOLEAN DEFAULT false;

-- Adicionar coluna 'type'
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT NULL;

-- Adicionar coluna 'deposit_id' para produtos por depósito
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS deposit_id UUID;

-- ============================================================
-- TABELA: service_order_items
-- ============================================================

-- Adicionar coluna 'sale_movement_type' (modo escolhido na venda)
ALTER TABLE public.service_order_items 
  ADD COLUMN IF NOT EXISTS sale_movement_type TEXT DEFAULT NULL;

COMMENT ON COLUMN public.service_order_items.sale_movement_type IS 
  'Modo de venda escolhido: EXCHANGE (troca - cliente devolveu casco) ou FULL (completa - cliente levou casco)';

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Índice para busca por tipo de movimento
CREATE INDEX IF NOT EXISTS idx_products_movement_type 
  ON public.products(movement_type);

-- Índice para busca por produto vinculado
CREATE INDEX IF NOT EXISTS idx_products_return_product_id 
  ON public.products(return_product_id);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
