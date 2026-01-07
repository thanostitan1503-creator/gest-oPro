-- Payment method configuration per deposit
-- Run in Supabase SQL Editor

create table if not exists public.payment_method_deposit_config (
  payment_method_id uuid not null references public.payment_methods(id) on delete cascade,
  deposit_id uuid not null references public.deposits(id) on delete cascade,
  is_active boolean not null default true,
  due_days integer not null default 0,
  max_installments integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (payment_method_id, deposit_id)
);

create index if not exists idx_pm_deposit_config_method
  on public.payment_method_deposit_config (payment_method_id);

create index if not exists idx_pm_deposit_config_deposit
  on public.payment_method_deposit_config (deposit_id);
