-- Privacy-preserving aggregate analytics for intentional item searches and scans.
-- Images, location coordinates, account identifiers, and autocomplete keystrokes
-- are deliberately excluded.

create table if not exists public.item_interaction_events (
  id uuid primary key default gen_random_uuid(),
  event_kind text not null check (event_kind in ('search', 'scan')),
  input_method text not null check (input_method in ('typed_search', 'suggestion', 'photo')),
  query_text text check (query_text is null or char_length(query_text) <= 120),
  identified_item text check (identified_item is null or char_length(identified_item) <= 120),
  resolved_item text check (resolved_item is null or char_length(resolved_item) <= 120),
  material text check (material is null or char_length(material) <= 80),
  verified boolean not null default false,
  confusing boolean not null default false,
  confidence_percent numeric(5, 2) check (
    confidence_percent is null or confidence_percent between 0 and 100
  ),
  image_status text check (
    image_status is null or image_status in ('single_item', 'multiple_items', 'unclear')
  ),
  client_platform text not null default 'unknown' check (
    client_platform in ('web', 'mobile', 'unknown')
  ),
  created_at timestamptz not null default now()
);

alter table public.item_interaction_events enable row level security;
revoke all on public.item_interaction_events from anon, authenticated;

create index if not exists item_interaction_events_created_at_idx
  on public.item_interaction_events (created_at desc);
create index if not exists item_interaction_events_kind_confusing_idx
  on public.item_interaction_events (event_kind, confusing, created_at desc);

create or replace function public.get_item_interaction_analytics(
  p_days integer default 30,
  p_limit integer default 25
)
returns table (
  item_name text,
  searches bigint,
  scans bigint,
  confusing_events bigint,
  confusion_rate numeric,
  last_seen timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Administrator access required';
  end if;

  return query
  with normalized as (
    select
      coalesce(
        nullif(trim(resolved_item), ''),
        nullif(trim(identified_item), ''),
        nullif(trim(query_text), ''),
        'Unknown item'
      ) as normalized_item,
      event_kind,
      confusing,
      created_at
    from public.item_interaction_events
    where created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  )
  select
    min(normalized_item) as item_name,
    count(*) filter (where event_kind = 'search') as searches,
    count(*) filter (where event_kind = 'scan') as scans,
    count(*) filter (where confusing) as confusing_events,
    round(
      100 * count(*) filter (where confusing)::numeric / nullif(count(*), 0),
      1
    ) as confusion_rate,
    max(created_at) as last_seen
  from normalized
  group by lower(normalized_item)
  order by
    count(*) desc,
    count(*) filter (where confusing) desc,
    min(normalized_item)
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

revoke all on function public.get_item_interaction_analytics(integer, integer) from public;
grant execute on function public.get_item_interaction_analytics(integer, integer) to authenticated;

comment on table public.item_interaction_events is
  'Aggregate item-search and scan outcomes. Never stores photos, coordinates, or user identifiers.';
