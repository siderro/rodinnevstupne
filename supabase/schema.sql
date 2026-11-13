-- ============================================================
-- rodinnevstupne.cz — schéma pro SDÍLENÝ Supabase projekt
-- Vše prefixováno `rv_`, nic existujícího se nemění.
-- Spusť celé v: Supabase → SQL Editor → Run. Je to idempotentní.
-- ============================================================

-- 1) Tabulka míst
create table if not exists public.rv_venues (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text unique,
  category             text,                 -- zoo / aquapark / hrad / muzeum / zabavni_park / ...
  kraj                 text,                 -- jeden ze 14 krajů ČR
  okres                text,                 -- volitelné (fáze 2)
  city                 text,
  address              text,
  lat                  double precision,     -- pro mapu (fáze 2)
  lng                  double precision,
  website              text,
  family_policy        text default 'none',  -- unlimited | max_children | kids_free_age | per_child | none
  max_children         integer,              -- strop dětí (pro family_policy = max_children)
  kids_free_under_age  integer,              -- děti zdarma do věku (pro kids_free_age)
  price_adult          numeric,
  price_child          numeric,
  price_family         numeric,
  family_ticket_desc   text,                 -- slovní popis podmínek
  notes                text,
  source_url           text,                 -- odkud info pochází
  verified_at          timestamptz,
  status               text not null default 'draft', -- draft | published | rejected
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint rv_venues_family_policy_chk
    check (family_policy in ('unlimited','max_children','kids_free_age','per_child','none')),
  constraint rv_venues_status_chk
    check (status in ('draft','published','rejected'))
);

create index if not exists rv_venues_status_idx   on public.rv_venues (status);
create index if not exists rv_venues_kraj_idx      on public.rv_venues (kraj);
create index if not exists rv_venues_category_idx  on public.rv_venues (category);

-- 2) Auto-update sloupce updated_at (funkce prefixovaná rv_)
create or replace function public.rv_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rv_venues_updated_at on public.rv_venues;
create trigger rv_venues_updated_at
  before update on public.rv_venues
  for each row execute function public.rv_set_updated_at();

-- 3) Row Level Security — jen na téhle tabulce
alter table public.rv_venues enable row level security;

-- Anonym (veřejný web) čte JEN publikované záznamy
drop policy if exists rv_venues_public_read on public.rv_venues;
create policy rv_venues_public_read
  on public.rv_venues for select
  to anon
  using (status = 'published');

-- Přihlášený admin (Supabase Auth) vidí a spravuje vše.
-- Kdo je admin: e-mail v seznamu níže. Uprav podle sebe.
drop policy if exists rv_venues_admin_all on public.rv_venues;
create policy rv_venues_admin_all
  on public.rv_venues for all
  to authenticated
  using ( (auth.jwt() ->> 'email') = any (array['jakub@svejda-goldmann.cz']) )
  with check ( (auth.jwt() ->> 'email') = any (array['jakub@svejda-goldmann.cz']) );

-- Pozn.: lokální sběrný skript používá service_role klíč, který RLS obchází.
