-- Align administrator discovery with existing management permissions.
-- Ordinary teachers still see only their own memberships.
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
        'role', coalesce(m.member_role, 'admin'),
        'can_delete', (public.ecolearn_is_admin() or c.created_by = v_user or m.member_role = 'owner'),
        'member_count', (select count(*) from public.ecolearn_community_members x where x.community_id = c.id),
        'classroom_count', (select count(*) from public.ecolearn_classrooms x where x.community_id = c.id and x.archived_at is null),
        'total_xp', (select coalesce(sum(p.xp), 0) from public.ecolearn_community_members x left join public.user_progress p on p.user_id = x.user_id where x.community_id = c.id),
        'total_scans', (select coalesce(sum(p.total_scans), 0) from public.ecolearn_community_members x left join public.user_progress p on p.user_id = x.user_id where x.community_id = c.id),
        'join_code', case when public.ecolearn_can_manage_community(c.id, v_user) then (select code from public.ecolearn_join_codes j where j.community_id = c.id and j.active = true and (j.expires_at is null or j.expires_at > now()) order by j.created_at desc limit 1) else null end
      ) order by c.name)
      from public.ecolearn_communities c left join public.ecolearn_community_members m on c.id = m.community_id and m.user_id = v_user
      where c.archived_at is null and (m.user_id is not null or public.ecolearn_is_admin())
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


create or replace function public.ecolearn_delete_space(p_scope text, p_scope_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_scope = 'community' then
    if not public.ecolearn_is_admin() and not exists (
      select 1 from public.ecolearn_communities where id = p_scope_id and created_by = auth.uid()
    ) and not exists (
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

