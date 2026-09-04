-- Community safety controls for user-generated announcements and events.
-- Publishing remains restricted to teachers, community managers, and admins.

alter table public.ecolearn_announcements
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null,
  add column if not exists removal_reason text;

alter table public.ecolearn_community_events
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null,
  add column if not exists removal_reason text;

create table if not exists public.ecolearn_blocked_users (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table if not exists public.ecolearn_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('announcement', 'event')),
  target_id uuid not null,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.ecolearn_communities(id) on delete cascade,
  classroom_id uuid references public.ecolearn_classrooms(id) on delete cascade,
  reason text not null check (reason in ('inappropriate', 'bullying', 'spam', 'privacy', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 500),
  check ((community_id is not null)::integer + (classroom_id is not null)::integer = 1)
);

create index if not exists ecolearn_reports_reporter_idx
  on public.ecolearn_content_reports(reporter_user_id, created_at desc);
create index if not exists ecolearn_reports_scope_idx
  on public.ecolearn_content_reports(community_id, classroom_id, status, created_at desc);
create unique index if not exists ecolearn_reports_one_pending_idx
  on public.ecolearn_content_reports(reporter_user_id, target_type, target_id)
  where status = 'pending';

alter table public.ecolearn_blocked_users enable row level security;
alter table public.ecolearn_content_reports enable row level security;

revoke all on public.ecolearn_blocked_users, public.ecolearn_content_reports from anon, authenticated;
grant select on public.ecolearn_blocked_users, public.ecolearn_content_reports to authenticated;

drop policy if exists "users read own blocks" on public.ecolearn_blocked_users;
create policy "users read own blocks" on public.ecolearn_blocked_users for select
using (blocker_user_id = auth.uid());

drop policy if exists "users read own reports" on public.ecolearn_content_reports;
create policy "users read own reports" on public.ecolearn_content_reports for select
using (reporter_user_id = auth.uid());

create or replace function public.ecolearn_users_share_space(p_first uuid, p_second uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_first is not null and p_second is not null and (
    exists (
      select 1
      from public.ecolearn_community_members a
      join public.ecolearn_community_members b on b.community_id = a.community_id
      where a.user_id = p_first and b.user_id = p_second
    )
    or exists (
      select 1
      from public.ecolearn_classroom_members a
      join public.ecolearn_classroom_members b on b.classroom_id = a.classroom_id
      where a.user_id = p_first and b.user_id = p_second
    )
  );
$$;

create or replace function public.ecolearn_validate_community_content(p_value text)
returns void
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare v_value text := lower(coalesce(p_value, ''));
begin
  if v_value ~ '(https?://|www\.)'
    or v_value ~ '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}'
    or v_value ~ '(\+?1[[:space:].-]?)?\(?[0-9]{3}\)?[[:space:].-]?[0-9]{3}[[:space:].-]?[0-9]{4}' then
    raise exception 'For student safety, community posts cannot include links, email addresses, or phone numbers';
  end if;

  if v_value ~ E'\\m(fuck|shit|bitch|cunt|nigger|faggot|kys|kill yourself|rape|porn|nude|nudes)\\M' then
    raise exception 'This post contains language that is not allowed in EcoLearn communities';
  end if;
end;
$$;

create or replace function public.ecolearn_create_announcement(p_scope text, p_scope_id uuid, p_title text, p_body text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform public.ecolearn_validate_community_content(p_title);
  perform public.ecolearn_validate_community_content(p_body);
  if p_scope = 'community' then
    if not public.ecolearn_can_manage_community(p_scope_id, v_user) then raise exception 'Manager access required'; end if;
    insert into public.ecolearn_announcements (community_id, title, body, created_by)
    values (p_scope_id, trim(p_title), trim(p_body), v_user) returning id into v_id;
  elsif p_scope = 'classroom' then
    if not public.ecolearn_can_manage_classroom(p_scope_id, v_user) then raise exception 'Teacher access required'; end if;
    insert into public.ecolearn_announcements (classroom_id, title, body, created_by)
    values (p_scope_id, trim(p_title), trim(p_body), v_user) returning id into v_id;
  else
    raise exception 'Choose community or classroom';
  end if;
  return v_id;
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
  insert into public.ecolearn_community_events (community_id, title, description, starts_at, location, created_by)
  values (p_community_id, trim(p_title), trim(coalesce(p_description, '')), p_starts_at, trim(coalesce(p_location, '')), v_user)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ecolearn_block_user(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_user_id = v_user then raise exception 'You cannot block yourself'; end if;
  if not public.ecolearn_users_share_space(v_user, p_user_id) and not public.ecolearn_is_admin(v_user) then
    raise exception 'You can only block someone in a shared community or classroom';
  end if;
  insert into public.ecolearn_blocked_users (blocker_user_id, blocked_user_id)
  values (v_user, p_user_id) on conflict do nothing;
end;
$$;

create or replace function public.ecolearn_unblock_user(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.ecolearn_blocked_users
  where blocker_user_id = auth.uid() and blocked_user_id = p_user_id;
end;
$$;

create or replace function public.ecolearn_report_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_creator uuid;
  v_community uuid;
  v_classroom uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('inappropriate', 'bullying', 'spam', 'privacy', 'other') then raise exception 'Choose a valid report reason'; end if;
  if char_length(coalesce(p_details, '')) > 500 then raise exception 'Report details must be 500 characters or fewer'; end if;

  if p_target_type = 'announcement' then
    select created_by, community_id, classroom_id into v_creator, v_community, v_classroom
    from public.ecolearn_announcements where id = p_target_id and removed_at is null;
  elsif p_target_type = 'event' then
    select created_by, community_id, null::uuid into v_creator, v_community, v_classroom
    from public.ecolearn_community_events where id = p_target_id and removed_at is null;
  else
    raise exception 'Choose announcement or event';
  end if;

  if v_creator is null then raise exception 'Content is unavailable'; end if;
  if v_creator = v_user then raise exception 'You cannot report your own content'; end if;
  if v_community is not null and not public.ecolearn_is_community_member(v_community, v_user) and not public.ecolearn_is_admin(v_user) then
    raise exception 'Community membership required';
  end if;
  if v_classroom is not null and not public.ecolearn_is_classroom_member(v_classroom, v_user) and not public.ecolearn_is_admin(v_user) then
    raise exception 'Classroom membership required';
  end if;

  insert into public.ecolearn_content_reports (
    reporter_user_id, target_type, target_id, reported_user_id,
    community_id, classroom_id, reason, details
  ) values (
    v_user, p_target_type, p_target_id, v_creator,
    v_community, v_classroom, p_reason, trim(coalesce(p_details, ''))
  ) returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'You already reported this content and it is awaiting review';
end;
$$;

create or replace function public.ecolearn_get_moderation_queue()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'target_type', r.target_type,
    'target_id', r.target_id,
    'target_title', case when r.target_type = 'announcement' then a.title else e.title end,
    'target_body', case when r.target_type = 'announcement' then a.body else e.description end,
    'reported_alias', coalesce(reported.public_alias, 'Eco learner'),
    'reporter_alias', coalesce(reporter.public_alias, 'Eco learner'),
    'reason', r.reason,
    'details', r.details,
    'status', r.status,
    'created_at', r.created_at
  ) order by r.created_at desc), '[]'::jsonb)
  from public.ecolearn_content_reports r
  left join public.ecolearn_announcements a on r.target_type = 'announcement' and a.id = r.target_id
  left join public.ecolearn_community_events e on r.target_type = 'event' and e.id = r.target_id
  left join public.ecolearn_profiles reported on reported.user_id = r.reported_user_id
  left join public.ecolearn_profiles reporter on reporter.user_id = r.reporter_user_id
  where r.status in ('pending', 'reviewed') and (
    public.ecolearn_is_admin(auth.uid())
    or (r.community_id is not null and public.ecolearn_can_manage_community(r.community_id, auth.uid()))
    or (r.classroom_id is not null and public.ecolearn_can_manage_classroom(r.classroom_id, auth.uid()))
  );
$$;

create or replace function public.ecolearn_resolve_report(p_report_id uuid, p_action text, p_note text default '')
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_report public.ecolearn_content_reports%rowtype; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_action not in ('remove', 'dismiss') then raise exception 'Choose remove or dismiss'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Moderator note must be 500 characters or fewer'; end if;
  select * into v_report from public.ecolearn_content_reports where id = p_report_id for update;
  if v_report.id is null then raise exception 'Report not found'; end if;
  if not public.ecolearn_is_admin(v_user)
    and not (v_report.community_id is not null and public.ecolearn_can_manage_community(v_report.community_id, v_user))
    and not (v_report.classroom_id is not null and public.ecolearn_can_manage_classroom(v_report.classroom_id, v_user)) then
    raise exception 'Moderator access required';
  end if;

  if p_action = 'remove' then
    if v_report.target_type = 'announcement' then
      update public.ecolearn_announcements set removed_at = now(), removed_by = v_user,
        removal_reason = coalesce(nullif(trim(p_note), ''), v_report.reason)
      where id = v_report.target_id and removed_at is null;
    else
      update public.ecolearn_community_events set removed_at = now(), removed_by = v_user,
        removal_reason = coalesce(nullif(trim(p_note), ''), v_report.reason)
      where id = v_report.target_id and removed_at is null;
    end if;
  end if;

  update public.ecolearn_content_reports
  set status = case when p_action = 'remove' then 'removed' else 'dismissed' end,
      reviewed_at = now(), reviewed_by = v_user, resolution_note = trim(coalesce(p_note, ''))
  where id = p_report_id;
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
        'join_code', case when public.ecolearn_can_manage_community(c.id, v_user) then (select code from public.ecolearn_join_codes j where j.community_id = c.id and j.active = true order by j.created_at desc limit 1) else null end
      ) order by c.name)
      from public.ecolearn_community_members m join public.ecolearn_communities c on c.id = m.community_id
      where m.user_id = v_user and c.archived_at is null
    ), '[]'::jsonb),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'community_id', c.community_id, 'school_name', s.name, 'name', c.name, 'grade_label', c.grade_label,
        'role', coalesce(m.classroom_role, 'teacher'),
        'student_count', (select count(*) from public.ecolearn_classroom_members x where x.classroom_id = c.id and x.classroom_role = 'student'),
        'total_xp', (select coalesce(sum(p.xp), 0) from public.ecolearn_classroom_members x left join public.user_progress p on p.user_id = x.user_id where x.classroom_id = c.id and x.classroom_role = 'student'),
        'lesson_completions', (select coalesce(sum(p.total_lessons_completed), 0) from public.ecolearn_classroom_members x left join public.user_progress p on p.user_id = x.user_id where x.classroom_id = c.id and x.classroom_role = 'student'),
        'join_code', case when public.ecolearn_can_manage_classroom(c.id, v_user) then (select code from public.ecolearn_join_codes j where j.classroom_id = c.id and j.access_role = 'student' and j.active = true order by j.created_at desc limit 1) else null end
      ) order by s.name, c.name)
      from public.ecolearn_classrooms c
      join public.ecolearn_communities s on s.id = c.community_id
      left join public.ecolearn_classroom_members m on m.classroom_id = c.id and m.user_id = v_user
      where c.archived_at is null and (m.user_id is not null or public.ecolearn_can_manage_community(c.community_id, v_user))
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

revoke all on function public.ecolearn_users_share_space(uuid, uuid),
  public.ecolearn_validate_community_content(text),
  public.ecolearn_block_user(uuid), public.ecolearn_unblock_user(uuid),
  public.ecolearn_report_content(text, uuid, text, text),
  public.ecolearn_get_moderation_queue(), public.ecolearn_resolve_report(uuid, text, text)
from public;

grant execute on function public.ecolearn_block_user(uuid), public.ecolearn_unblock_user(uuid),
  public.ecolearn_report_content(text, uuid, text, text),
  public.ecolearn_get_moderation_queue(), public.ecolearn_resolve_report(uuid, text, text)
to authenticated;
