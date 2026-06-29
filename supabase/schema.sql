-- Run this whole file once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- for a fresh project. Mirrors the 7 syncable local tables, keyed by the client-generated
-- `uuid` (globally unique already, so it's used directly as the primary key). Cross-row
-- references use the referenced row's uuid instead of a local autoincrement id.
--
-- Phase 2 is push-only: the app inserts/updates rows here but never reads them back yet.
-- RLS scopes every row to its owning auth.uid() so one user's data is never visible to another.

create table if not exists public.categories (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income', 'both')),
  color text not null,
  icon text,
  is_archived boolean not null default false,
  is_biller boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.account_categories (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  icon text,
  kind text not null default 'standard' check (kind in ('standard', 'credit_card', 'investment')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.accounts (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category_uuid uuid not null references public.account_categories (uuid),
  color text not null,
  icon text,
  account_number text,
  qr_image_uri text,
  starting_balance bigint not null default 0,
  is_archived boolean not null default false,
  include_in_net_worth boolean not null default true,
  monthly_amount_due bigint,
  remaining_months integer,
  monthly_due_last_paid_month text,
  monthly_contribution bigint,
  balance_last_updated_at text,
  total_months integer not null default 0,
  credit_limit bigint,
  linked_credit_card_uuid uuid references public.accounts (uuid),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recurring_transactions (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount bigint not null,
  note text,
  category_uuid uuid references public.categories (uuid),
  biller_uuid uuid references public.categories (uuid),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  interval_count integer not null default 1,
  start_date text not null,
  end_date text,
  next_run_date text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.transactions (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount bigint not null,
  fee bigint not null default 0,
  occurred_at text not null,
  note text,
  establishment text,
  category_uuid uuid references public.categories (uuid),
  account_uuid uuid references public.accounts (uuid),
  recurring_uuid uuid references public.recurring_transactions (uuid),
  receipt_image_uri text,
  exclude_from_expense boolean not null default false,
  transfer_uuid uuid references public.transactions (uuid),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.budgets (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_uuid uuid not null references public.categories (uuid),
  month text not null,
  amount_limit bigint not null,
  alert_threshold_pct integer not null default 90,
  last_alert_pct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.bills (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount bigint not null,
  category_uuid uuid references public.categories (uuid),
  biller_uuid uuid references public.categories (uuid),
  account_uuid uuid references public.accounts (uuid),
  to_account_uuid uuid references public.accounts (uuid),
  due_date text not null,
  frequency text not null default 'once' check (frequency in ('once', 'weekly', 'semi_monthly', 'monthly', 'yearly', 'every_n_days')),
  interval_days integer,
  reminder_days_before integer not null default 1,
  reminded_at text,
  is_paid boolean not null default false,
  last_paid_at text,
  paid_transaction_uuid uuid references public.transactions (uuid),
  exclude_from_expense boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_categories_user_updated on public.categories (user_id, updated_at);
create index if not exists idx_account_categories_user_updated on public.account_categories (user_id, updated_at);
create index if not exists idx_accounts_user_updated on public.accounts (user_id, updated_at);
create index if not exists idx_recurring_transactions_user_updated on public.recurring_transactions (user_id, updated_at);
create index if not exists idx_transactions_user_updated on public.transactions (user_id, updated_at);
create index if not exists idx_budgets_user_updated on public.budgets (user_id, updated_at);
create index if not exists idx_bills_user_updated on public.bills (user_id, updated_at);

alter table public.categories enable row level security;
alter table public.account_categories enable row level security;
alter table public.accounts enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.bills enable row level security;

-- One [select/insert/update] policy per table, scoped to the row's owner. No delete policy:
-- deletions are soft (deleted_at), matching the local app's convention.
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'account_categories', 'accounts', 'recurring_transactions', 'transactions', 'budgets', 'bills']
  loop
    execute format('create policy "select_own_%1$s" on public.%1$s for select using (auth.uid() = user_id);', t);
    execute format('create policy "insert_own_%1$s" on public.%1$s for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "update_own_%1$s" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;
