-- Keep removed and blocked community content hidden even if a client queries
-- the underlying tables instead of the curated hub RPC.

drop policy if exists "members read announcements" on public.ecolearn_announcements;
create policy "members read announcements" on public.ecolearn_announcements for select
using (
  removed_at is null
  and not exists (
    select 1 from public.ecolearn_blocked_users b
    where b.blocker_user_id = auth.uid()
      and b.blocked_user_id = ecolearn_announcements.created_by
  )
  and (
    (community_id is not null and public.ecolearn_is_community_member(community_id))
    or (classroom_id is not null and public.ecolearn_is_classroom_member(classroom_id))
    or public.ecolearn_is_admin()
  )
);

drop policy if exists "members read events" on public.ecolearn_community_events;
create policy "members read events" on public.ecolearn_community_events for select
using (
  removed_at is null
  and not exists (
    select 1 from public.ecolearn_blocked_users b
    where b.blocker_user_id = auth.uid()
      and b.blocked_user_id = ecolearn_community_events.created_by
  )
  and (public.ecolearn_is_community_member(community_id) or public.ecolearn_is_admin())
);

create or replace function public.ecolearn_rsvp_event(p_event_id uuid, p_status text default 'going')
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_community uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select community_id into v_community
  from public.ecolearn_community_events
  where id = p_event_id and removed_at is null;
  if v_community is null then raise exception 'Event is unavailable'; end if;
  if not public.ecolearn_is_community_member(v_community, v_user) then raise exception 'Community membership required'; end if;
  insert into public.ecolearn_event_rsvps (event_id, user_id, status)
  values (p_event_id, v_user, lower(p_status))
  on conflict (event_id, user_id) do update set status = excluded.status;
end;
$$;
