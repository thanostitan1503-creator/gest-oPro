-- ================================================================
-- Migration: Create zone_pricing table
-- Data: 2 de Janeiro de 2026
-- Descrição: Permite mesmo produto ter preços diferentes por depósito
-- ================================================================

CREATE TABLE IF NOT EXISTS zone_pricing (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  deposit_id TEXT NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint único: um produto só pode ter um preço por depósito
  UNIQUE(product_id, deposit_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_zone_pricing_product ON zone_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_zone_pricing_deposit ON zone_pricing(deposit_id);
CREATE INDEX IF NOT EXISTS idx_zone_pricing_composite ON zone_pricing(product_id, deposit_id);

-- Comentários para documentação
COMMENT ON TABLE zone_pricing IS 'Armazena preços específicos de produtos por depósito';
COMMENT ON COLUMN zone_pricing.product_id IS 'ID do produto (global/único)';
COMMENT ON COLUMN zone_pricing.deposit_id IS 'ID do depósito específico';
COMMENT ON COLUMN zone_pricing.price IS 'Preço de venda neste depósito';
