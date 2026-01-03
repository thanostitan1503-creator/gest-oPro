-- DEV ONLY: ajuste rápido para evitar erros de RLS durante desenvolvimento.
-- Rode no Supabase Dashboard → SQL Editor.
--
-- Opção A (mais rápida): DESATIVAR RLS nas tabelas que você está testando.
-- (Recomendado apenas em DEV)

-- alter table public.deposits disable row level security;
-- alter table public.products disable row level security;
-- alter table public.employees disable row level security;
-- alter table public.payment_methods disable row level security;
-- alter table public.clients disable row level security;

-- Opção B (um pouco melhor): manter RLS ligado mas criar policy permissiva para DEV.
-- Exemplo para products:

-- alter table public.products enable row level security;
-- drop policy if exists "dev_all_products" on public.products;
-- create policy "dev_all_products"
-- on public.products
-- for all
-- to anon, authenticated
-- using (true)
-- with check (true);
