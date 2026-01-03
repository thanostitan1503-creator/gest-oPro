-- Adds stock movement rules per product.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'SIMPLE',
  ADD COLUMN IF NOT EXISTS return_product_id TEXT REFERENCES public.products(id);

COMMENT ON COLUMN public.products.movement_type IS
  'Defines stock rule: EXCHANGE, FULL, SIMPLE';
