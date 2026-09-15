-- Deletion hides a space immediately. Owners have seven days to restore it.
alter table public.ecolearn_communities add column delete_after timestamptz;
alter table public.ecolearn_classrooms add column delete_after timestamptz;
create index ecolearn_communities_expiry on public.ecolearn_communities(delete_after) where delete_after is not null;
create index ecolearn_classrooms_expiry on public.ecolearn_classrooms(delete_after) where delete_after is not null;

create or replace function public.ecolearn_is_community_member(p_community_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.ecolearn_community_members m join public.ecolearn_communities c on c.id = m.community_id
    where c.id = p_community_id and c.archived_at is null and m.user_id = p_user_id
  );
$$;

create or replace function public.ecolearn_can_manage_community(p_community_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.ecolearn_communities c where c.id = p_community_id and c.archived_at is null
    and (public.ecolearn_is_admin(p_user_id) or exists (
      select 1 from public.ecolearn_community_members m where m.community_id = c.id and m.user_id = p_user_id and m.member_role in ('owner','manager')
    ))
  );
$$;

create or replace function public.ecolearn_is_classroom_member(p_classroom_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.ecolearn_classroom_members m join public.ecolearn_classrooms c on c.id = m.classroom_id
    join public.ecolearn_communities s on s.id = c.community_id
    where c.id = p_classroom_id and c.archived_at is null and s.archived_at is null and m.user_id = p_user_id
  );
$$;

create or replace function public.ecolearn_can_manage_classroom(p_classroom_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.ecolearn_classrooms c join public.ecolearn_communities s on s.id = c.community_id
    where c.id = p_classroom_id and c.archived_at is null and s.archived_at is null
    and (public.ecolearn_can_manage_community(c.community_id, p_user_id) or exists (
      select 1 from public.ecolearn_classroom_members m where m.classroom_id = c.id and m.user_id = p_user_id and m.classroom_role = 'teacher'
    ))
  );
$$;

-- Recovery uses ownership, not active membership helpers, since the space is hidden.
create or replace function public.ecolearn_can_delete_space(p_scope text, p_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select auth.uid() is not null and case p_scope
    when 'community' then exists(select 1 from public.ecolearn_communities c where c.id = p_id and
      (public.ecolearn_is_admin() or c.created_by = auth.uid() or exists(select 1 from public.ecolearn_community_members m where m.community_id = c.id and m.user_id = auth.uid() and m.member_role = 'owner')))
    when 'classroom' then exists(select 1 from public.ecolearn_classrooms c where c.id = p_id and
      (public.ecolearn_is_admin() or c.created_by = auth.uid() or exists(select 1 from public.ecolearn_community_members m where m.community_id = c.community_id and m.user_id = auth.uid() and m.member_role in ('owner','manager'))))
    else false end;
$$;

create or replace function public.ecolearn_delete_space(p_scope text, p_scope_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.ecolearn_can_delete_space(p_scope, p_scope_id) then
    if p_scope = 'community' then raise exception 'Only the community owner can delete this community'; end if;
    raise exception 'Only the classroom creator or school manager can delete this classroom';
  end if;
  if p_scope = 'community' then
    update public.ecolearn_communities set archived_at = now(), delete_after = now() + interval '7 days'
      where id = p_scope_id and archived_at is null;
  else
    update public.ecolearn_classrooms set archived_at = now(), delete_after = now() + interval '7 days'
      where id = p_scope_id and archived_at is null
        and exists(select 1 from public.ecolearn_communities s where s.id = community_id and s.archived_at is null);
  end if;
  if not found then raise exception 'Space is unavailable or already deleted'; end if;
end;
$$;

create or replace function public.ecolearn_get_deleted_spaces()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return coalesce((select jsonb_agg(x order by x.delete_after) from (
    select 'community'::text as scope, c.id, c.name, c.delete_after from public.ecolearn_communities c
      where c.archived_at is not null and c.delete_after > now() and public.ecolearn_can_delete_space('community', c.id)
    union all
    select 'classroom', c.id, c.name, c.delete_after from public.ecolearn_classrooms c
      join public.ecolearn_communities s on s.id = c.community_id
      where c.archived_at is not null and c.delete_after > now() and s.archived_at is null and public.ecolearn_can_delete_space('classroom', c.id)
  ) x), '[]'::jsonb);
end;
$$;

create or replace function public.ecolearn_restore_space(p_scope text, p_scope_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ecolearn_can_delete_space(p_scope, p_scope_id) then raise exception 'Only the owner or an authorized administrator can restore this space'; end if;
  if p_scope = 'community' then
    update public.ecolearn_communities set archived_at = null, delete_after = null
      where id = p_scope_id and delete_after > now();
  else
    update public.ecolearn_classrooms set archived_at = null, delete_after = null
      where id = p_scope_id and delete_after > now()
        and exists(select 1 from public.ecolearn_communities s where s.id = community_id and s.archived_at is null);
  end if;
  if not found then raise exception 'The recovery period has expired, or the parent community must be restored first'; end if;
end;
$$;

create or replace function public.ecolearn_purge_deleted_spaces()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.ecolearn_classrooms where delete_after <= now();
  delete from public.ecolearn_communities where delete_after <= now();
end;
$$;

-- Account deletion explicitly discards the caller's recoverable spaces as well.
create or replace function public.ecolearn_prepare_account_deletion(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists(select 1 from public.ecolearn_communities where created_by = p_user_id and archived_at is null)
    or exists(select 1 from public.ecolearn_classrooms c join public.ecolearn_communities s on s.id = c.community_id
      where c.created_by = p_user_id and c.archived_at is null and s.archived_at is null) then
    raise exception 'Delete the spaces you created before deleting your account';
  end if;
  delete from public.ecolearn_classrooms where created_by = p_user_id;
  delete from public.ecolearn_communities where created_by = p_user_id;
end;
$$;

revoke all on function public.ecolearn_can_delete_space(text,uuid), public.ecolearn_purge_deleted_spaces(), public.ecolearn_prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.ecolearn_purge_deleted_spaces(), public.ecolearn_prepare_account_deletion(uuid) to service_role;
revoke all on function public.ecolearn_get_deleted_spaces(), public.ecolearn_restore_space(text,uuid) from public, anon;
grant execute on function public.ecolearn_get_deleted_spaces(), public.ecolearn_restore_space(text,uuid) to authenticated;

-- Hidden spaces cannot generate or deliver notifications.
create or replace function public.ecolearn_notification_allowed(p public.notifications)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (p.community_id is null or exists(select 1 from public.ecolearn_communities c where c.id = p.community_id and c.archived_at is null))
    and (p.classroom_id is null or exists(select 1 from public.ecolearn_classrooms c join public.ecolearn_communities s on s.id = c.community_id where c.id = p.classroom_id and c.archived_at is null and s.archived_at is null))
    and (p.classroom_id is null or exists(select 1 from public.ecolearn_classroom_members where classroom_id = p.classroom_id and user_id = p.user_id))
    and (p.community_id is null or exists(select 1 from public.ecolearn_community_members where community_id = p.community_id and user_id = p.user_id))
    and not exists(select 1 from public.ecolearn_blocked_users where blocker_user_id = p.user_id and blocked_user_id = p.actor_id)
    and (p.kind <> 'announcement' or exists(select 1 from public.ecolearn_announcements where id = p.source_id and removed_at is null))
    and (p.kind <> 'event' or exists(select 1 from public.ecolearn_community_events where id = p.source_id and removed_at is null))
    and (p.kind not in ('assignment','due') or exists(select 1 from public.ecolearn_assignments where id = p.source_id))
    and (p.kind <> 'due' or exists(select 1 from public.ecolearn_assignments a where a.id = p.source_id and a.due_at > now()
      and not exists(select 1 from public.lesson_progress lp where lp.user_id = p.user_id and lp.lesson_id = a.lesson_id and lp.status = 'completed')))
    and (p.kind <> 'streak' or exists(select 1 from public.user_progress where user_id = p.user_id and last_activity_date = current_date - 1))
    and coalesce((select case when p.kind = 'streak' then streak_reminders when p.kind in ('assignment','due') then learning_updates else community_updates end
      from public.ecolearn_notification_preferences where user_id = p.user_id), true);
$$;

create or replace function public.ecolearn_enqueue_reminders()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications(user_id, title, body, kind, target_path, dedupe_key)
  select p.user_id, 'Keep your learning streak going', 'Complete a lesson or scan an item today.', 'streak', '/learn',
    'streak:' || (now() at time zone coalesce(np.timezone, 'America/New_York'))::date
  from public.user_progress p left join public.ecolearn_notification_preferences np on np.user_id = p.user_id
  where p.streak_days > 0 and p.last_activity_date = current_date - 1
    and coalesce(np.streak_reminders, true)
    and extract(hour from now() at time zone coalesce(np.timezone, 'America/New_York')) = coalesce(np.reminder_hour, 18)
  on conflict do nothing;
  insert into public.notifications(user_id, title, body, kind, target_path, dedupe_key, classroom_id, actor_id, source_id)
  select m.user_id, 'An assignment is due soon', a.title, 'due', '/schools', 'due:' || a.id, a.classroom_id, a.created_by, a.id
  from public.ecolearn_assignments a join public.ecolearn_classroom_members m on m.classroom_id = a.classroom_id and m.classroom_role = 'student'
  where exists(select 1 from public.ecolearn_classrooms c join public.ecolearn_communities s on s.id = c.community_id where c.id = a.classroom_id and c.archived_at is null and s.archived_at is null)
    and a.due_at > now() and a.due_at <= now() + interval '24 hours'
    and not exists(select 1 from public.lesson_progress lp where lp.lesson_id = a.lesson_id and lp.user_id = m.user_id and lp.status = 'completed')
  on conflict do nothing;
end; $$;
