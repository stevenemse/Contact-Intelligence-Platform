-- Migration billing : colonnes d'abonnement sur organizations + journal des changements de plan.
-- À exécuter dans le SQL Editor de Supabase.

alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists current_period_end timestamptz,
  add column if not exists billing_email text;

create table if not exists plan_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_plan text,
  to_plan text not null,
  source text not null check (source in ('stripe', 'admin')),
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists plan_changes_org_idx on plan_changes(organization_id, created_at desc);
