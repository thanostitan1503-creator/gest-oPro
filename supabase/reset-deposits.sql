-- ====================================================================
-- SCRIPT DE RESET COMPLETO - Depósitos Corrompidos
-- ====================================================================
-- Este script limpa os depósitos corrompidos e dados relacionados
-- Após executar, faça logout e primeiro acesso novamente no frontend
-- ====================================================================

-- 1. LIMPAR OUTBOX EVENTS relacionados a depósitos
DELETE FROM outbox_events WHERE entity = 'deposits';

-- 2. LIMPAR TABELAS RELACIONADAS (para evitar FK constraints)
-- Employees vinculados a depósitos
UPDATE employees SET deposit_id = NULL WHERE deposit_id IS NOT NULL;

-- Service Orders
DELETE FROM service_order_items WHERE os_id IN (SELECT id FROM service_orders);
DELETE FROM service_orders;

-- Stock Movements
DELETE FROM stock_movements;

-- Cash Flow
DELETE FROM cash_flow_entries;

-- Work Shifts
DELETE FROM work_shifts;

-- Products (se estiverem vinculados a depósitos)
DELETE FROM products;

-- Delivery Zones Pricing (híbrido)
DELETE FROM zone_pricing;

-- 3. LIMPAR DEPÓSITOS CORROMPIDOS
DELETE FROM deposits;

-- 4. VERIFICAR LIMPEZA
SELECT 'Depósitos restantes:' as status, COUNT(*) as count FROM deposits;
SELECT 'Employees sem depósito:' as status, COUNT(*) as count FROM employees WHERE deposit_id IS NULL;
SELECT 'Outbox events restantes:' as status, COUNT(*) as count FROM outbox_events;

-- ====================================================================
-- APÓS EXECUTAR ESTE SCRIPT:
-- ====================================================================
-- 1. No frontend, abra DevTools (F12)
-- 2. Execute no Console:
--    localStorage.clear();
--    await db.delete();
--    location.reload();
--
-- 3. Faça o primeiro acesso novamente
-- 4. O sistema vai criar o depósito corretamente usando upsertDeposit
-- ====================================================================
