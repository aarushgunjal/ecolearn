-- Official Delaware guidance mirrored from DNREC Recyclopedia (location ID 38).
-- Content is refreshed by the sync-delaware-recyclopedia Edge Function; users may only read it.

create table if not exists public.delaware_guidance_items (
  source_topic_id bigint primary key,
  title text not null,
  seo_name text not null unique,
  content_html text not null default '',
  content_text text not null default '',
  tags jsonb not null default '[]'::jsonb,
  synonyms jsonb not null default '[]'::jsonb,
  search_terms text[] not null default '{}'::text[],
  source_updated_at timestamptz,
  source_url text not null,
  source_location_id integer not null default 38,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delaware_guidance_items_search_terms_idx
  on public.delaware_guidance_items using gin (search_terms);
create index if not exists delaware_guidance_items_title_idx
  on public.delaware_guidance_items (title);

alter table public.delaware_guidance_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'delaware_guidance_items'
      and policyname = 'authenticated read Delaware guidance'
  ) then
    create policy "authenticated read Delaware guidance"
      on public.delaware_guidance_items
      for select to authenticated
      using (true);
  end if;
end $$;

create table if not exists public.delaware_guidance_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed')),
  topics_seen integer not null default 0,
  topics_updated integer not null default 0,
  topics_skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  source_url text not null default 'https://dnrec.delaware.gov/waste-hazardous/recycling/what/'
);

alter table public.delaware_guidance_sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'delaware_guidance_sync_runs'
      and policyname = 'admins read Delaware guidance sync runs'
  ) then
    create policy "admins read Delaware guidance sync runs"
      on public.delaware_guidance_sync_runs
      for select to authenticated
      using (public.is_app_admin());
  end if;
end $$;

create or replace function public.touch_delaware_guidance_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_delaware_guidance_items on public.delaware_guidance_items;
create trigger touch_delaware_guidance_items
before update on public.delaware_guidance_items
for each row execute function public.touch_delaware_guidance_items();
