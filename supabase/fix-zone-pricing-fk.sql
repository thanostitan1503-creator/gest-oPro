-- ====================================================================
-- FIX: Foreign Key Constraint para zone_pricing
-- ====================================================================
-- Este script corrige a constraint FK que estava causando o erro 23503
-- quando zona e pricing eram salvos em sequência rápida
-- ====================================================================

-- 1. Verificar constraint atual
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'zone_pricing'::regclass
  AND contype = 'f'; -- Foreign keys

-- 2. OPÇÃO A: Tornar a FK DEFERRABLE (permite commit em batch)
-- Isso permite que zona e pricing sejam inseridos na mesma transação
-- sem ordem específica

-- Remover constraint antiga
ALTER TABLE zone_pricing 
DROP CONSTRAINT IF EXISTS zone_pricing_zone_id_fkey;

-- Recriar como DEFERRABLE INITIALLY DEFERRED
ALTER TABLE zone_pricing
ADD CONSTRAINT zone_pricing_zone_id_fkey
FOREIGN KEY (zone_id) 
REFERENCES delivery_zones(id)
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- 3. OPÇÃO B: Se DEFERRABLE causar problemas, garantir ordem no trigger
-- (Não execute junto com Opção A - escolha uma)

/*
-- Criar trigger para validar ordem (fallback)
CREATE OR REPLACE FUNCTION validate_zone_exists()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_zones WHERE id = NEW.zone_id) THEN
    RAISE EXCEPTION 'Zone % does not exist. Create zone first.', NEW.zone_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_zone_exists_before_pricing ON zone_pricing;
CREATE TRIGGER check_zone_exists_before_pricing
  BEFORE INSERT OR UPDATE ON zone_pricing
  FOR EACH ROW
  EXECUTE FUNCTION validate_zone_exists();
*/

-- 4. Verificar correção
SELECT 
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'zone_pricing'::regclass
  AND conname = 'zone_pricing_zone_id_fkey';

-- Deve mostrar: DEFERRABLE INITIALLY DEFERRED

-- ====================================================================
-- IMPORTANTE: Use a OPÇÃO A (DEFERRABLE)
-- Isso permite que o frontend salve zona + pricing na mesma transação
-- sem erro de FK, mesmo que o pricing chegue antes da zona no Supabase
-- ====================================================================
