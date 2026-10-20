-- =============================================================
--  Contact Intelligence Platform — schéma Supabase v1
--  À exécuter une seule fois dans le SQL Editor de Supabase.
-- =============================================================

create extension if not exists "pgcrypto";

-- ── Organisations / memberships ─────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  plan text not null default 'free',
  contact_quota integer not null default 5000,
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  name text,
  role text not null default 'viewer'
    check (role in ('owner','admin','manager','member','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists memberships_user_idx on memberships(user_id);
create index if not exists memberships_org_idx on memberships(organization_id);

create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  status text not null default 'pending',
  invited_by uuid,
  created_at timestamptz not null default now()
);

-- ── Contacts ────────────────────────────────────────────────
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  company text,
  job_title text,
  source text,
  notes text,
  country_iso2 text,
  country_name text,
  city text,
  region text,
  merged_into uuid references contacts(id),
  import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_org_idx on contacts(organization_id);
create index if not exists contacts_created_idx on contacts(organization_id, created_at desc);
create index if not exists contacts_fullname_idx on contacts(organization_id, full_name);
create index if not exists contacts_country_idx on contacts(organization_id, country_iso2);
create index if not exists contacts_source_idx on contacts(organization_id, source);

create table if not exists contact_phones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  raw_phone text not null,
  normalized_phone text,
  e164 text,
  country_code text,
  is_valid boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists phones_contact_idx on contact_phones(contact_id);
create index if not exists phones_normalized_idx on contact_phones(organization_id, normalized_phone);

create table if not exists contact_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  email text not null,
  is_valid boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists emails_contact_idx on contact_emails(contact_id);
create index if not exists emails_email_idx on contact_emails(organization_id, email);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists contact_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contact_id, tag_id)
);

-- ── Champs personnalisés ────────────────────────────────────
create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  key text not null,
  type text not null default 'text'
    check (type in ('text','number','date','boolean')),
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

-- ── Segments / imports / exports ────────────────────────────
create table if not exists segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  rules jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid,
  file_name text not null,
  status text not null default 'processing',
  source text,
  mapping jsonb,
  duplicate_rules jsonb,
  total_rows integer not null default 0,
  new_contacts integer not null default 0,
  duplicates_skipped integer not null default 0,
  invalid_phones integer not null default 0,
  invalid_emails integer not null default 0,
  errors_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists export_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid,
  scope text not null,
  scope_desc text,
  country_iso2s text[],
  columns text[],
  status text not null default 'done',
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Journal / audit ─────────────────────────────────────────
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action text not null,
  entity text,
  entity_id text,
  uid text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists logs_org_created_idx on activity_logs(organization_id, created_at desc);

create table if not exists merge_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  keeper_id uuid not null,
  merged_id uuid not null,
  kept_values jsonb,
  discarded_values jsonb,
  merged_by uuid,
  merged_at timestamptz not null default now()
);

create table if not exists contact_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  fields jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists changes_contact_idx on contact_changes(contact_id, changed_at desc);

-- ── Référentiel pays (name_fr) ──────────────────────────────
create table if not exists countries (
  iso2 text primary key,
  name_fr text not null,
  region text
);

insert into countries (iso2, name_fr, region) values
  ('CM','Cameroun','Afrique'),('CI','Côte d''Ivoire','Afrique'),
  ('SN','Sénégal','Afrique'),('NG','Nigéria','Afrique'),('GH','Ghana','Afrique'),
  ('FR','France','Europe'),('BE','Belgique','Europe'),('CH','Suisse','Europe'),
  ('CA','Canada','Amérique'),('US','États-Unis','Amérique'),
  ('GB','Royaume-Uni','Europe'),('DE','Allemagne','Europe'),('ES','Espagne','Europe'),
  ('MA','Maroc','Afrique'),('DZ','Algérie','Afrique'),('TN','Tunisie','Afrique'),
  ('CD','RD Congo','Afrique'),('CG','Congo','Afrique'),('GA','Gabon','Afrique'),
  ('SA','Arabie Saoudite','Asie'),('AE','Émirats Arabes Unis','Asie'),
  ('BJ','Bénin','Afrique'),('TG','Togo','Afrique'),('BF','Burkina Faso','Afrique'),
  ('ML','Mali','Afrique'),('NE','Niger','Afrique'),('GN','Guinée','Afrique'),
  ('RW','Rwanda','Afrique'),('BI','Burundi','Afrique'),('KE','Kenya','Afrique'),
  ('TZ','Tanzanie','Afrique'),('UG','Ouganda','Afrique'),('ZA','Afrique du Sud','Afrique'),
  ('IT','Italie','Europe'),('NL','Pays-Bas','Europe'),('PT','Portugal','Europe'),
  ('CN','Chine','Asie'),('IN','Inde','Asie'),('BR','Brésil','Amérique'),
  ('MX','Mexique','Amérique'),('AU','Australie','Océanie')
on conflict (iso2) do nothing;

-- ── Groupes de doublons (RPC) ───────────────────────────────
create or replace function duplicate_groups(org uuid, max_groups integer default 100)
returns table (normalized_phone text, n bigint, contact_ids jsonb)
language sql stable as $$
  select p.normalized_phone,
         count(distinct p.contact_id) as n,
         jsonb_agg(distinct p.contact_id) as contact_ids
  from contact_phones p
  join contacts c on c.id = p.contact_id
  where p.organization_id = org
    and p.normalized_phone is not null
    and c.merged_into is null
  group by p.normalized_phone
  having count(distinct p.contact_id) > 1
  order by n desc
  limit greatest(1, least(max_groups, 500));
$$;

-- RLS : désactivée — toutes les requêtes passent par le serveur Next.js
-- (client service_role) qui applique l'autorisation par organisation.
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table org_invites enable row level security;
alter table contacts enable row level security;
alter table contact_phones enable row level security;
alter table contact_emails enable row level security;
alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table custom_fields enable row level security;
alter table segments enable row level security;
alter table import_batches enable row level security;
alter table export_runs enable row level security;
alter table activity_logs enable row level security;
alter table merge_logs enable row level security;
alter table contact_changes enable row level security;
alter table countries enable row level security;

-- accès en lecture publique du référentiel pays uniquement
create policy "countries readable" on countries for select using (true);
