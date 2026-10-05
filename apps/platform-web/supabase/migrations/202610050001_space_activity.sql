-- Space activity is attributed at earning time. Lifetime XP is never backfilled
-- into communities: past activity has no trustworthy space attribution.
begin;
create table public.ecolearn_space_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.ecolearn_communities(id) on delete cascade,
  classroom_id uuid references public.ecolearn_classrooms(id) on delete cascade,
  xp integer not null check (xp > 0),
  scans integer not null default 0 check (scans >= 0),
  lessons integer not null default 0 check (lessons >= 0),
  created_at timestamptz not null default now()
);
create index ecolearn_activity_community on public.ecolearn_space_activity(community_id);
create index ecolearn_activity_classroom on public.ecolearn_space_activity(classroom_id, user_id);
alter table public.ecolearn_space_activity enable row level security;
revoke all on public.ecolearn_space_activity from public, anon, authenticated;

create or replace function public.ecolearn_activity_scope(p_scope text, p_scope_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_community uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform set_config('ecolearn.activity_community', '', true);
  perform set_config('ecolearn.activity_classroom', '', true);
  if p_scope is null and p_scope_id is null then return; end if;
  if p_scope = 'community' and public.ecolearn_is_community_member(p_scope_id) then
    v_community := p_scope_id;
  elsif p_scope = 'classroom' and public.ecolearn_is_classroom_member(p_scope_id) and exists(
    select 1 from public.ecolearn_classroom_members where classroom_id = p_scope_id and user_id = auth.uid() and classroom_role = 'student'
  ) then
    select community_id into v_community from public.ecolearn_classrooms where id = p_scope_id;
    perform set_config('ecolearn.activity_classroom', p_scope_id::text, true);
  else raise exception 'This learning space is unavailable. Choose personal learning or an active space you belong to.';
  end if;
  perform set_config('ecolearn.activity_community', v_community::text, true);
end; $$;

create or replace function public.ecolearn_capture_space_activity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_community uuid := nullif(current_setting('ecolearn.activity_community', true),'')::uuid;
begin
  if new.xp > old.xp and v_community is not null and new.user_id = auth.uid() then
    insert into public.ecolearn_space_activity(user_id, community_id, classroom_id, xp, scans, lessons)
    values(new.user_id, v_community, nullif(current_setting('ecolearn.activity_classroom', true),'')::uuid,
      new.xp-old.xp, greatest(0,new.total_scans-old.total_scans), greatest(0,new.total_lessons_completed-old.total_lessons_completed));
  end if;
  return new;
end; $$;
create trigger ecolearn_capture_space_activity after update on public.user_progress
for each row execute function public.ecolearn_capture_space_activity();
revoke all on function public.ecolearn_activity_scope(text,uuid), public.ecolearn_capture_space_activity() from public, anon, authenticated;


drop function public.record_ecolearn_scan(text,boolean,numeric,text,text,uuid);

create or replace function public.record_ecolearn_scan(
  p_item_name text,
  p_is_recyclable boolean,
  p_confidence_score numeric,
  p_category text,
  p_instructions text,
  p_client_request_id uuid default gen_random_uuid(), p_scope text default null, p_scope_id uuid default null
) returns public.user_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_progress public.user_progress;
  v_today date := current_date;
  v_streak integer;
  v_official_title text;
  v_official_instructions text;
  v_official_tags jsonb;
  v_official_category text;
  v_official_curbside boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform public.ecolearn_activity_scope(p_scope, p_scope_id);
  if p_client_request_id is null then raise exception 'Request ID required'; end if;
  if char_length(trim(coalesce(p_item_name, ''))) = 0 or char_length(p_item_name) > 160 then
    raise exception 'Invalid item name';
  end if;
  insert into public.user_progress(user_id) values(v_user) on conflict do nothing;
  perform 1 from public.user_progress where user_id = v_user for update;
  if exists (
    select 1 from public.scan_history
    where user_id = v_user and client_request_id = p_client_request_id
  ) then
    select * into v_progress from public.user_progress where user_id = v_user;
    return v_progress;
  end if;
  if (
    select count(*) from public.scan_history
    where user_id = v_user and created_at >= date_trunc('day', now())
  ) >= 100 then
    raise exception 'Daily scan limit reached';
  end if;

  -- Never trust the browser's disposal fields. An earnable scan must reference
  -- one exact title in the mirrored official catalog, and the stored outcome is
  -- derived from that record.
  select item.title, item.content_text, item.tags
  into v_official_title, v_official_instructions, v_official_tags
  from public.delaware_guidance_items item
  where lower(item.title) = lower(trim(p_item_name))
  limit 1;
  if v_official_title is null then
    raise exception 'Official Delaware DNREC item required';
  end if;
  v_official_curbside := exists (
    select 1 from jsonb_array_elements(coalesce(v_official_tags, '[]'::jsonb)) tag
    where lower(coalesce(tag->>'tag', '')) like '%acceptable to recycle curbside%'
      and lower(coalesce(tag->>'tag', '')) not like '%not acceptable%'
  );
  v_official_category := case
    when exists (
      select 1 from jsonb_array_elements(coalesce(v_official_tags, '[]'::jsonb)) tag
      where lower(coalesce(tag->>'tag', '')) like '%not acceptable to recycle curbside%'
    ) then 'Keep out of curbside recycling'
    when v_official_curbside then 'Curbside recycling'
    when exists (
      select 1 from jsonb_array_elements(coalesce(v_official_tags, '[]'::jsonb)) tag
      where lower(coalesce(tag->>'tag', '')) like '%household hazardous%'
    ) then 'Household hazardous waste'
    when exists (
      select 1 from jsonb_array_elements(coalesce(v_official_tags, '[]'::jsonb)) tag
      where lower(coalesce(tag->>'tag', '')) like '%drop-off%'
    ) then 'Drop-off or specialty program'
    when exists (
      select 1 from jsonb_array_elements(coalesce(v_official_tags, '[]'::jsonb)) tag
      where lower(coalesce(tag->>'tag', '')) like '%yard waste%'
    ) then 'Yard waste'
    else 'Delaware-specific guidance'
  end;

  insert into public.user_progress (user_id) values (v_user) on conflict do nothing;
  select case
    when last_activity_date = v_today then streak_days
    when last_activity_date = v_today - 1 then streak_days + 1
    else 1
  end into v_streak
  from public.user_progress
  where user_id = v_user
  for update;

  insert into public.scan_history (
    user_id, item_name, is_recyclable, confidence_score, category,
    instructions, client_request_id
  ) values (
    v_user,
    v_official_title,
    v_official_curbside,
    greatest(0, least(100, coalesce(p_confidence_score, 0))),
    v_official_category,
    left(coalesce(nullif(v_official_instructions, ''), 'See the official Delaware DNREC record.'), 1000),
    p_client_request_id
  );

  update public.user_progress
  set xp = xp + 10,
      level = floor((xp + 10) / 100.0)::integer + 1,
      total_scans = total_scans + 1,
      streak_days = v_streak,
      last_activity_date = v_today,
      updated_at = now()
  where user_id = v_user
  returning * into v_progress;

  insert into public.user_achievements (user_id, achievement_id)
  select v_user, id from public.achievements
  where (requirement_type = 'scans' and v_progress.total_scans >= requirement_value)
     or (requirement_type = 'streak' and v_progress.streak_days >= requirement_value)
     or (requirement_type = 'level' and v_progress.level >= requirement_value)
  on conflict do nothing;
  return v_progress;
end;
$$;

revoke all on function public.record_ecolearn_scan(text,boolean,numeric,text,text,uuid,text,uuid) from public, anon;
grant execute on function public.record_ecolearn_scan(text,boolean,numeric,text,text,uuid,text,uuid) to authenticated;

drop function public.complete_ecolearn_lesson(uuid,integer);

create or replace function public.complete_ecolearn_lesson(
  p_lesson_id uuid,
  p_selected_answer integer, p_scope text default null, p_scope_id uuid default null
) returns public.user_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_expected integer;
  v_xp integer;
  v_progress public.user_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform public.ecolearn_activity_scope(p_scope, p_scope_id);
  select answer.correct_answer, lesson.xp_reward
  into v_expected, v_xp
  from public.lesson_answer_keys answer
  join public.lessons lesson on lesson.id = answer.lesson_id
  where answer.lesson_id = p_lesson_id and lesson.is_published;
  if v_expected is null or p_selected_answer is distinct from v_expected then
    raise exception 'Correct answer required';
  end if;

  insert into public.user_progress (user_id) values (v_user) on conflict do nothing;
  select * into v_progress
  from public.user_progress
  where user_id = v_user
  for update;
  if exists (
    select 1 from public.lesson_progress
    where user_id = v_user and lesson_id = p_lesson_id and status = 'completed'
  ) then
    return v_progress;
  end if;

  insert into public.quiz_attempts (user_id, lesson_id, answers, score)
  values (v_user, p_lesson_id, jsonb_build_object('selected', p_selected_answer), 100);
  insert into public.lesson_progress (user_id, lesson_id, status, score, completed_at)
  values (v_user, p_lesson_id, 'completed', 100, now())
  on conflict (user_id, lesson_id) do update set
    status = excluded.status,
    score = excluded.score,
    completed_at = excluded.completed_at;

  update public.user_progress
  set xp = xp + v_xp,
      level = floor((xp + v_xp) / 100.0)::integer + 1,
      total_lessons_completed = total_lessons_completed + 1,
      streak_days = case when last_activity_date = current_date then streak_days when last_activity_date = current_date - 1 then streak_days + 1 else 1 end,
      last_activity_date = current_date,
      updated_at = now()
  where user_id = v_user
  returning * into v_progress;

  insert into public.user_achievements (user_id, achievement_id)
  select v_user, id from public.achievements
  where (requirement_type = 'lessons' and v_progress.total_lessons_completed >= requirement_value)
     or (requirement_type = 'streak' and v_progress.streak_days >= requirement_value)
     or (requirement_type = 'level' and v_progress.level >= requirement_value)
  on conflict do nothing;
  return v_progress;
end;
$$;

revoke all on function public.complete_ecolearn_lesson(uuid,integer,text,uuid) from public, anon;
grant execute on function public.complete_ecolearn_lesson(uuid,integer,text,uuid) to authenticated;

drop function public.claim_ecolearn_reward(text);

create or replace function public.claim_ecolearn_reward(p_reward_key text, p_scope text default null, p_scope_id uuid default null)
returns public.user_progress language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_progress public.user_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform public.ecolearn_activity_scope(p_scope, p_scope_id);
  if p_reward_key is distinct from 'daily_three_scans' then raise exception 'This reward is unavailable'; end if;
  select * into v_progress from public.user_progress where user_id = v_user for update;
  if coalesce(v_progress.total_scans, 0) < 3 then raise exception 'Complete three verified scans first'; end if;
  insert into public.reward_claims(user_id, reward_key) values(v_user, p_reward_key) on conflict do nothing;
  if not found then return v_progress; end if;
  update public.user_progress set xp = xp + 15, level = floor((xp + 15) / 100.0)::integer + 1, updated_at = now()
  where user_id = v_user returning * into v_progress;
  perform public.award_eligible_achievements(v_user);
  return v_progress;
end; $$;

revoke all on function public.claim_ecolearn_reward(text,text,uuid) from public, anon;
grant execute on function public.claim_ecolearn_reward(text,text,uuid) to authenticated;

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
        'total_xp', (select coalesce(sum(a.xp), 0) from public.ecolearn_space_activity a where a.community_id = c.id),
        'total_scans', (select coalesce(sum(a.scans), 0) from public.ecolearn_space_activity a where a.community_id = c.id),
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
        'total_xp', (select coalesce(sum(a.xp), 0) from public.ecolearn_space_activity a where a.classroom_id = c.id),
        'lesson_completions', (select coalesce(sum(a.lessons), 0) from public.ecolearn_space_activity a where a.classroom_id = c.id),
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

create or replace function public.ecolearn_get_classroom_dashboard(p_classroom_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if not public.ecolearn_can_manage_classroom(p_classroom_id, v_user) then raise exception 'Teacher access required'; end if;
  select jsonb_build_object(
    'students', coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'alias', coalesce(pf.public_alias, 'Eco learner'),
      'xp', coalesce(p.xp, 0), 'level', coalesce(p.level, 1), 'scans', coalesce(p.total_scans, 0),
      'lessons', coalesce(p.total_lessons_completed, 0), 'streak', coalesce(p.streak_days, 0)
    ) order by coalesce(p.xp, 0) desc, pf.public_alias)
    from public.ecolearn_classroom_members m
    left join public.ecolearn_profiles pf on pf.user_id = m.user_id
    left join lateral (
      select coalesce(sum(a.xp),0)::integer as xp, (coalesce(sum(a.xp),0)/100)::integer+1 as level,
        coalesce(sum(a.scans),0)::integer as total_scans, coalesce(sum(a.lessons),0)::integer as total_lessons_completed,
        (select count(*)::integer from (
          select day, row_number() over(order by day desc) as n, max(day) over() as latest from
          (select distinct created_at::date as day from public.ecolearn_space_activity where classroom_id=p_classroom_id and user_id=m.user_id) d
        ) days where latest >= current_date - 1 and day = latest - (n::integer-1)) as streak_days
      from public.ecolearn_space_activity a where a.classroom_id = p_classroom_id and a.user_id=m.user_id
    ) p on true
    where m.classroom_id = p_classroom_id and m.classroom_role = 'student'), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'lesson_id', a.lesson_id, 'lesson_title', l.title, 'due_at', a.due_at,
      'completed_count', (select count(*) from public.ecolearn_classroom_members cm join public.lesson_progress lp on lp.user_id = cm.user_id and lp.lesson_id = a.lesson_id and lp.status = 'completed' where cm.classroom_id = p_classroom_id and cm.classroom_role = 'student'),
      'student_count', (select count(*) from public.ecolearn_classroom_members cm where cm.classroom_id = p_classroom_id and cm.classroom_role = 'student')
    ) order by a.due_at nulls last, a.created_at desc)
    from public.ecolearn_assignments a join public.lessons l on l.id = a.lesson_id where a.classroom_id = p_classroom_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.ecolearn_get_school_standings(p_community_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.ecolearn_is_community_member(p_community_id) and not public.ecolearn_is_admin() then raise exception 'School membership required'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.total_xp desc, r.name)
    from (
      select c.id, c.name, c.grade_label,
        (select count(*)::integer from public.ecolearn_classroom_members m where m.classroom_id=c.id and m.classroom_role='student') as student_count,
        coalesce(sum(p.xp), 0)::integer as total_xp,
        coalesce(sum(p.scans), 0)::integer as total_scans,
        coalesce(sum(p.lessons), 0)::integer as lesson_completions
      from public.ecolearn_classrooms c
      left join public.ecolearn_space_activity p on p.classroom_id = c.id
      where c.community_id = p_community_id and c.archived_at is null
      group by c.id, c.name, c.grade_label
    ) r
  ), '[]'::jsonb);
end;
$$;

commit;
