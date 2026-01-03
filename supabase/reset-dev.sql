-- ATENÇÃO: ESTE SCRIPT APAGA DADOS.
-- Use SOMENTE em ambiente de desenvolvimento/teste.
-- Rode no Supabase Dashboard → SQL Editor.
--
-- Dica: se algum nome de tabela estiver diferente do seu schema, ajuste aqui.

begin;

-- Apaga dados em cascata respeitando dependências.
-- Se suas tabelas usam UUID (sem identity), o RESTART IDENTITY é inofensivo.
truncate table
  public.receivable_payments,
  public.accounts_receivable,
  public.service_order_items,
  public.service_orders,
  public.cash_movements,
  public.cash_sessions,
  public.stock_movements,
  public.stock_balance,
  public.stock_transfer_items,
  public.stock_transfers,
  public.stock_count_items,
  public.stock_counts,
  public.delivery_jobs,
  public.driver_presence,
  public.client_one_time_discount,
  public.client_price_overrides,
  public.clients,
  public.payment_methods,
  public.employees,
  public.price_table,
  public.products,
  public.deposits,
  public.audit_logs
restart identity cascade;

commit;
