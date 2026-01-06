-- ============================================================
-- MIGRAÇÃO SEGURA - Adicionar colunas faltantes
-- Data: 05/01/2026
-- ============================================================
-- Este script NÃO apaga tabelas existentes!
-- Apenas adiciona colunas que faltam.
-- ============================================================

-- ============================================================
-- TABELA: stock_movements
-- ============================================================
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'Ajuste Manual';

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS origin TEXT;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'IN';

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS product_id UUID;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS deposit_id UUID;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS user_name TEXT;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS reference_id UUID;

ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- TABELA: products
-- ============================================================
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Código/SKU do produto (frontend usa `codigo`)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Descrição
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Unidade (UN, KG, L, etc.)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'UN';

-- Preços
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS exchange_price NUMERIC(10,2);

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS full_price NUMERIC(10,2);

-- Markup/Margem
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS markup NUMERIC(10,2) DEFAULT 0;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'SIMPLE';

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS return_product_id UUID;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT true;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS is_delivery_fee BOOLEAN DEFAULT false;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS deposit_id UUID;

-- Grupo de produto
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS product_group TEXT;

-- Rastreia vasilhames
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS tracks_empties BOOLEAN DEFAULT false;

-- Imagem
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Sincronizar ativo entre colunas (ambas em inglês)
UPDATE public.products SET active = COALESCE(active, is_active, true) WHERE active IS NULL;
UPDATE public.products SET is_active = COALESCE(is_active, active, true) WHERE is_active IS NULL;

-- ============================================================
-- TABELA: service_order_items
-- ============================================================
ALTER TABLE public.service_order_items 
  ADD COLUMN IF NOT EXISTS sale_movement_type TEXT;

-- ============================================================
-- TABELA: service_orders
-- ============================================================
ALTER TABLE public.service_orders 
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;

ALTER TABLE public.service_orders 
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'BALCAO';

ALTER TABLE public.service_orders 
  ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- ============================================================
-- TABELA: employees
-- ============================================================
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ============================================================
-- TABELA: clients
-- ============================================================
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ============================================================
-- TABELA: deposits
-- ============================================================
ALTER TABLE public.deposits 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.deposits 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ============================================================
-- FIM DA MIGRAÇÃO SEGURA
-- ============================================================
