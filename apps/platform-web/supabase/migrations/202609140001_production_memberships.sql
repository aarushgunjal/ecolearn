-- Teacher signup and membership integrity. Admin access remains separately assigned.

create or replace function public.handle_new_ecolearn_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ecolearn_profiles (user_id, account_role, public_alias)
  values (new.id, case when new.raw_user_meta_data->>'account_role' = 'teacher' then 'teacher' else 'student' end, case
    when char_length(trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', '')))) between 2 and 40
      then trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', '')))
    else 'Eco learner'
  end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.ecolearn_set_profile(p_alias text, p_role text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_alias text := trim(coalesce(p_alias, ''));
  v_role text := lower(trim(coalesce(p_role, '')));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if char_length(v_alias) < 2 or char_length(v_alias) > 40 then raise exception 'Choose an alias between 2 and 40 characters'; end if;
  if v_role not in ('student', 'teacher') then raise exception 'Choose student or teacher access'; end if;
  if v_role = 'student' and (
    exists (select 1 from public.ecolearn_community_members where user_id = v_user and member_role in ('owner', 'manager'))
    or exists (select 1 from public.ecolearn_classroom_members where user_id = v_user and classroom_role = 'teacher')
  ) then raise exception 'Leave or delete the spaces you manage before switching to student'; end if;
  insert into public.ecolearn_profiles (user_id, account_role, public_alias, updated_at)
  values (v_user, v_role, v_alias, now())
  on conflict (user_id) do update set account_role = excluded.account_role, public_alias = excluded.public_alias, updated_at = now();
  return jsonb_build_object('user_id', v_user, 'role', v_role, 'alias', v_alias);
end;
$$;

create or replace function public.ecolearn_join_space(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_join public.ecolearn_join_codes;
  v_community_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_join from public.ecolearn_join_codes
  where code = upper(trim(p_code)) and active = true and (expires_at is null or expires_at > now())
  for update;
  if not found then raise exception 'That join code is invalid or expired'; end if;
  if v_join.community_id is not null then
    if not exists (select 1 from public.ecolearn_communities where id = v_join.community_id and archived_at is null) then
      raise exception 'That community is unavailable';
    end if;
    if exists (select 1 from public.ecolearn_community_members where community_id = v_join.community_id and user_id = v_user) then
      raise exception 'You already belong to this community';
    end if;
    insert into public.ecolearn_community_members (community_id, user_id, member_role)
    values (v_join.community_id, v_user, 'member') on conflict do nothing;
    return jsonb_build_object('scope', 'community', 'id', v_join.community_id);
  end if;
  select community_id into v_community_id from public.ecolearn_classrooms where id = v_join.classroom_id and archived_at is null;
  if v_community_id is null then raise exception 'That classroom is unavailable'; end if;
  if not exists (select 1 from public.ecolearn_communities where id = v_community_id and archived_at is null) then
    raise exception 'That community is unavailable';
  end if;
  if exists (select 1 from public.ecolearn_classrooms where id = v_join.classroom_id and created_by = v_user)
    or exists (select 1 from public.ecolearn_classroom_members where classroom_id = v_join.classroom_id and user_id = v_user and (classroom_role = 'teacher' or v_join.access_role = 'student')) then
    raise exception 'You already belong to this classroom';
  end if;
  if v_join.access_role = 'teacher' then
    insert into public.ecolearn_profiles (user_id, account_role, public_alias, updated_at)
    values (v_user, 'teacher', coalesce((select public_alias from public.ecolearn_profiles where user_id = v_user), 'Eco learner'), now())
    on conflict (user_id) do update set account_role = 'teacher', updated_at = now();
  end if;
  insert into public.ecolearn_community_members (community_id, user_id, member_role)
  values (v_community_id, v_user, 'member') on conflict do nothing;
  insert into public.ecolearn_classroom_members (classroom_id, user_id, classroom_role)
  values (v_join.classroom_id, v_user, case when v_join.access_role = 'teacher' then 'teacher' else 'student' end)
  on conflict (classroom_id, user_id) do update set classroom_role = 'teacher'
  where excluded.classroom_role = 'teacher';
  return jsonb_build_object('scope', 'classroom', 'id', v_join.classroom_id, 'community_id', v_community_id);
end;
$$;

create or replace function public.ecolearn_leave_space(p_scope text, p_scope_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_scope = 'classroom' then
    if exists (select 1 from public.ecolearn_classrooms where id = p_scope_id and created_by = v_user) then
      raise exception 'Delete the classroom you created before leaving';
    end if;
    delete from public.ecolearn_classroom_members where classroom_id = p_scope_id and user_id = v_user;
  elsif p_scope = 'community' then
    if exists (select 1 from public.ecolearn_community_members where community_id = p_scope_id and user_id = v_user and member_role in ('owner', 'manager')) then
      raise exception 'Transfer community management before leaving';
    end if;
    if exists (select 1 from public.ecolearn_classroom_members cm join public.ecolearn_classrooms c on c.id = cm.classroom_id where c.community_id = p_scope_id and cm.user_id = v_user and cm.classroom_role = 'teacher') then
      raise exception 'You still teach a classroom in this community';
    end if;
    delete from public.ecolearn_event_rsvps r using public.ecolearn_community_events e where r.event_id = e.id and e.community_id = p_scope_id and r.user_id = v_user;
    delete from public.ecolearn_classroom_members cm using public.ecolearn_classrooms c
      where cm.classroom_id = c.id and c.community_id = p_scope_id and cm.user_id = v_user and cm.classroom_role <> 'teacher';
    delete from public.ecolearn_community_members where community_id = p_scope_id and user_id = v_user;
  else
    raise exception 'Choose community or classroom';
  end if;
end;
$$;

create or replace function public.ecolearn_rotate_join_code(p_scope text, p_scope_id uuid, p_access_role text default null)
returns text
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_role text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_scope = 'community' then
    if not public.ecolearn_can_manage_community(p_scope_id, v_user) then raise exception 'Manager access required'; end if;
    perform 1 from public.ecolearn_communities where id = p_scope_id and archived_at is null for update;
    if not found then raise exception 'Community unavailable'; end if;
    v_role := 'member';
    update public.ecolearn_join_codes set active = false where community_id = p_scope_id and access_role = v_role;
    v_code := public.ecolearn_make_join_code('COM');
    insert into public.ecolearn_join_codes (code, community_id, access_role, created_by) values (v_code, p_scope_id, v_role, v_user);
  elsif p_scope = 'classroom' then
    if not public.ecolearn_can_manage_classroom(p_scope_id, v_user) then raise exception 'Teacher access required'; end if;
    perform 1 from public.ecolearn_classrooms where id = p_scope_id and archived_at is null for update;
    if not found then raise exception 'Classroom unavailable'; end if;
    v_role := case when p_access_role = 'teacher' then 'teacher' else 'student' end;
    update public.ecolearn_join_codes set active = false where classroom_id = p_scope_id and access_role = v_role;
    v_code := public.ecolearn_make_join_code(case when v_role = 'teacher' then 'TCH' else 'CLS' end);
    insert into public.ecolearn_join_codes (code, classroom_id, access_role, created_by) values (v_code, p_scope_id, v_role, v_user);
  else
    raise exception 'Choose community or classroom';
  end if;
  return v_code;
end;
$$;

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
  if p_status = 'cancelled' then
    delete from public.ecolearn_event_rsvps where event_id = p_event_id and user_id = v_user;
    return;
  end if;
  if not exists (select 1 from public.ecolearn_community_events where id = p_event_id and starts_at > now()) then raise exception 'This event has already started'; end if;
  insert into public.ecolearn_event_rsvps (event_id, user_id, status)
  values (p_event_id, v_user, lower(p_status))
  on conflict (event_id, user_id) do update set status = excluded.status;
end;
$$;

create or replace function public.ecolearn_create_classroom(p_community_id uuid, p_name text, p_grade_label text default '')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_classroom public.ecolearn_classrooms;
  v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.ecolearn_effective_role() not in ('teacher', 'admin') then raise exception 'Teacher access is required to create a classroom'; end if;
  if not public.ecolearn_can_manage_community(p_community_id, v_user) then raise exception 'Community manager access is required'; end if;
  if not exists (select 1 from public.ecolearn_communities where id = p_community_id and kind = 'school' and archived_at is null) then
    raise exception 'Classrooms must belong to a school community';
  end if;
  if not exists (select 1 from public.ecolearn_communities where id = p_community_id and kind = 'school' and archived_at is null) then raise exception 'Choose an active school'; end if;
  insert into public.ecolearn_classrooms (community_id, name, grade_label, created_by)
  values (p_community_id, trim(p_name), trim(coalesce(p_grade_label, '')), v_user)
  returning * into v_classroom;
  insert into public.ecolearn_classroom_members (classroom_id, user_id, classroom_role)
  values (v_classroom.id, v_user, 'teacher');
  v_code := public.ecolearn_make_join_code('CLS');
  insert into public.ecolearn_join_codes (code, classroom_id, access_role, created_by)
  values (v_code, v_classroom.id, 'student', v_user);
  return jsonb_build_object('id', v_classroom.id, 'name', v_classroom.name, 'grade_label', v_classroom.grade_label, 'join_code', v_code);
end;
$$;

create or replace function public.ecolearn_create_event(p_community_id uuid, p_title text, p_description text, p_starts_at timestamptz, p_location text default '')
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.ecolearn_can_manage_community(p_community_id, v_user) then raise exception 'Manager access required'; end if;
  perform public.ecolearn_validate_community_content(p_title);
  perform public.ecolearn_validate_community_content(p_description);
  perform public.ecolearn_validate_community_content(p_location);
  if p_starts_at is null or p_starts_at <= now() then raise exception 'Choose a future event time'; end if;
  insert into public.ecolearn_community_events (community_id, title, description, starts_at, location, created_by)
  values (p_community_id, trim(p_title), trim(coalesce(p_description, '')), p_starts_at, trim(coalesce(p_location, '')), v_user)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ecolearn_get_hub()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'role', public.ecolearn_effective_role(),
      'alias', coalesce((select public_alias from public.ecolearn_profiles where user_id = v_user), 'Eco learner')
    ),
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'description', c.description, 'kind', c.kind,
        'role', m.member_role,
        'member_count', (select count(*) from public.ecolearn_community_members x where x.community_id = c.id),
        'classroom_count', (select count(*) from public.ecolearn_classrooms x where x.community_id = c.id and x.archived_at is null),
        'total_xp', (select coalesce(sum(p.xp), 0) from public.ecolearn_community_members x left join public.user_progress p on p.user_id = x.user_id where x.community_id = c.id),
        'total_scans', (select coalesce(sum(p.total_scans), 0) from public.ecolearn_community_members x left join public.user_progress p on p.user_id = x.user_id where x.community_id = c.id),
        'join_code', case when public.ecolearn_can_manage_community(c.id, v_user) then (select code from public.ecolearn_join_codes j where j.community_id = c.id and j.active = true and (j.expires_at is null or j.expires_at > now()) order by j.created_at desc limit 1) else null end
      ) order by c.name)
      from public.ecolearn_community_members m join public.ecolearn_communities c on c.id = m.community_id
      where m.user_id = v_user and c.archived_at is null
    ), '[]'::jsonb),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'community_id', c.community_id, 'school_name', s.name, 'name', c.name, 'grade_label', c.grade_label,
        'role', case when public.ecolearn_can_manage_classroom(c.id, v_user) then 'teacher' else 'student' end,
        'can_delete', (c.created_by = v_user or public.ecolearn_can_manage_community(c.community_id, v_user)),
        'student_count', (select count(*) from public.ecolearn_classroom_members x where x.classroom_id = c.id and x.classroom_role = 'student'),
        'total_xp', (select coalesce(sum(p.xp), 0) from public.ecolearn_classroom_members x left join public.user_progress p on p.user_id = x.user_id where x.classroom_id = c.id and x.classroom_role = 'student'),
        'lesson_completions', (select coalesce(sum(p.total_lessons_completed), 0) from public.ecolearn_classroom_members x left join public.user_progress p on p.user_id = x.user_id where x.classroom_id = c.id and x.classroom_role = 'student'),
        'join_code', case when public.ecolearn_can_manage_classroom(c.id, v_user) then (select code from public.ecolearn_join_codes j where j.classroom_id = c.id and j.access_role = 'student' and j.active = true and (j.expires_at is null or j.expires_at > now()) order by j.created_at desc limit 1) else null end
      ) order by s.name, c.name)
      from public.ecolearn_classrooms c
      join public.ecolearn_communities s on s.id = c.community_id
      left join public.ecolearn_classroom_members m on m.classroom_id = c.id and m.user_id = v_user
      where c.archived_at is null and s.archived_at is null and (m.user_id is not null or public.ecolearn_can_manage_community(c.community_id, v_user))
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'classroom_id', a.classroom_id, 'classroom_name', c.name,
        'lesson_id', a.lesson_id, 'lesson_title', l.title, 'title', a.title, 'due_at', a.due_at,
        'completed', exists (select 1 from public.lesson_progress lp where lp.user_id = v_user and lp.lesson_id = a.lesson_id and lp.status = 'completed')
      ) order by a.due_at nulls last, a.created_at desc)
      from public.ecolearn_assignments a
      join public.ecolearn_classrooms c on c.id = a.classroom_id
      join public.lessons l on l.id = a.lesson_id
      where public.ecolearn_is_classroom_member(a.classroom_id, v_user)
    ), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'body', a.body, 'created_at', a.created_at,
        'created_by', a.created_by, 'creator_alias', coalesce(p.public_alias, 'EcoLearn manager'),
        'scope', case when a.classroom_id is null then 'community' else 'classroom' end,
        'scope_id', coalesce(a.classroom_id, a.community_id)
      ) order by a.created_at desc)
      from (select * from public.ecolearn_announcements where removed_at is null and
        ((community_id is not null and public.ecolearn_is_community_member(community_id, v_user))
        or (classroom_id is not null and public.ecolearn_is_classroom_member(classroom_id, v_user)))
        and not exists (select 1 from public.ecolearn_blocked_users b where b.blocker_user_id = v_user and b.blocked_user_id = created_by)
        order by created_at desc limit 20) a
      left join public.ecolearn_profiles p on p.user_id = a.created_by
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'community_id', e.community_id, 'title', e.title, 'description', e.description,
        'starts_at', e.starts_at, 'location', e.location, 'created_by', e.created_by,
        'creator_alias', coalesce(p.public_alias, 'EcoLearn manager'),
        'rsvp_count', (select count(*) from public.ecolearn_event_rsvps r where r.event_id = e.id),
        'rsvped', exists (select 1 from public.ecolearn_event_rsvps r where r.event_id = e.id and r.user_id = v_user)
      ) order by e.starts_at)
      from public.ecolearn_community_events e
      left join public.ecolearn_profiles p on p.user_id = e.created_by
      where e.removed_at is null and e.starts_at >= now() - interval '1 day'
        and public.ecolearn_is_community_member(e.community_id, v_user)
        and not exists (select 1 from public.ecolearn_blocked_users b where b.blocker_user_id = v_user and b.blocked_user_id = e.created_by)
    ), '[]'::jsonb),
    'blocked_users', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', b.blocked_user_id, 'alias', coalesce(p.public_alias, 'EcoLearn member')) order by p.public_alias)
      from public.ecolearn_blocked_users b left join public.ecolearn_profiles p on p.user_id = b.blocked_user_id
      where b.blocker_user_id = v_user
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;


-- Destruction is restricted to owners (communities) and creators/school managers (classes).
create or replace function public.ecolearn_delete_space(p_scope text, p_scope_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_scope = 'community' then
    if not public.ecolearn_is_admin() and not exists (
      select 1 from public.ecolearn_community_members where community_id = p_scope_id and user_id = auth.uid() and member_role = 'owner'
    ) then raise exception 'Only the community owner can delete this community'; end if;
    delete from public.ecolearn_communities where id = p_scope_id;
  elsif p_scope = 'classroom' then
    if not exists (select 1 from public.ecolearn_classrooms c where c.id = p_scope_id and
      (c.created_by = auth.uid() or public.ecolearn_can_manage_community(c.community_id))) then
      raise exception 'Only the classroom creator or school manager can delete this classroom';
    end if;
    delete from public.ecolearn_classrooms where id = p_scope_id;
  else raise exception 'Choose community or classroom'; end if;
  if not found then raise exception 'Space not found'; end if;
end; $$;
revoke all on function public.ecolearn_delete_space(text, uuid) from public;
grant execute on function public.ecolearn_delete_space(text, uuid) to authenticated;

create or replace function public.ecolearn_delete_content(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_kind = 'assignment' then
    select public.ecolearn_can_manage_classroom(classroom_id) into v_allowed from public.ecolearn_assignments where id = p_id;
  elsif p_kind = 'announcement' then
    select case when classroom_id is not null then public.ecolearn_can_manage_classroom(classroom_id) else public.ecolearn_can_manage_community(community_id) end into v_allowed from public.ecolearn_announcements where id = p_id;
  elsif p_kind = 'event' then
    select public.ecolearn_can_manage_community(community_id) into v_allowed from public.ecolearn_community_events where id = p_id;
  end if;
  if not coalesce(v_allowed, false) then raise exception 'Manager access required'; end if;
  if p_kind = 'assignment' then delete from public.ecolearn_assignments where id = p_id;
  elsif p_kind = 'announcement' then delete from public.ecolearn_announcements where id = p_id;
  else delete from public.ecolearn_community_events where id = p_id; end if;
end; $$;
revoke all on function public.ecolearn_delete_content(text, uuid) from public;
grant execute on function public.ecolearn_delete_content(text, uuid) to authenticated;

create or replace function public.ecolearn_remove_classroom_member(p_classroom_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.ecolearn_can_manage_classroom(p_classroom_id) then raise exception 'Teacher access required'; end if;
  if exists(select 1 from public.ecolearn_classrooms where id = p_classroom_id and created_by = p_user_id) then raise exception 'The classroom creator cannot be removed'; end if;
  if exists(select 1 from public.ecolearn_classroom_members where classroom_id = p_classroom_id and user_id = p_user_id and classroom_role = 'teacher')
    and not exists(select 1 from public.ecolearn_classrooms where id = p_classroom_id and (created_by = auth.uid() or public.ecolearn_can_manage_community(community_id))) then
    raise exception 'Only the classroom creator or school manager can remove a teacher';
  end if;
  delete from public.ecolearn_classroom_members where classroom_id = p_classroom_id and user_id = p_user_id;
  if not found then raise exception 'Member not found'; end if;
end; $$;
revoke all on function public.ecolearn_remove_classroom_member(uuid, uuid) from public;
grant execute on function public.ecolearn_remove_classroom_member(uuid, uuid) to authenticated;

create or replace function public.ecolearn_create_assignment(p_classroom_id uuid, p_lesson_id uuid, p_title text, p_due_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.ecolearn_can_manage_classroom(p_classroom_id) then raise exception 'Teacher access required'; end if;
  perform 1 from public.ecolearn_classrooms where id = p_classroom_id and archived_at is null for update;
  if not found then raise exception 'Classroom unavailable'; end if;
  if not exists(select 1 from public.lessons where id = p_lesson_id and is_published) then raise exception 'Choose a published lesson'; end if;
  if p_due_at is not null and p_due_at <= now() then raise exception 'Choose a future due date'; end if;
  if exists(select 1 from public.ecolearn_assignments where classroom_id = p_classroom_id and lesson_id = p_lesson_id and due_at is not distinct from p_due_at) then
    raise exception 'This lesson is already assigned for that due date';
  end if;
  insert into public.ecolearn_assignments(classroom_id,lesson_id,title,due_at,created_by)
  values(p_classroom_id,p_lesson_id,trim(p_title),p_due_at,auth.uid()) returning id into v_id;
  return v_id;
end; $$;
