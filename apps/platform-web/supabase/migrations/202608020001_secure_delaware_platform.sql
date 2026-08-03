-- Track and complete the security work that was first drafted in the obsolete
-- ecoscan workspace. This migration is safe to rerun after a partial manual run.

alter table public.scan_history add column if not exists client_request_id uuid;
create unique index if not exists scan_history_user_request_unique
  on public.scan_history (user_id, client_request_id)
  where client_request_id is not null;

create table if not exists public.ai_request_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_kind text not null check (request_kind in ('delaware_catalog_match')),
  created_at timestamptz not null default now()
);
create index if not exists ai_request_log_user_created_idx
  on public.ai_request_log (user_id, created_at desc);
alter table public.ai_request_log enable row level security;
revoke all on public.ai_request_log from anon, authenticated;

create table if not exists public.lesson_answer_keys (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  correct_answer integer not null check (correct_answer between 0 and 10)
);
alter table public.lesson_answer_keys enable row level security;
revoke all on public.lesson_answer_keys from anon, authenticated;

create table if not exists public.reward_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null check (reward_key in ('daily_three_scans', 'weekend_reusable_cup')),
  claimed_at timestamptz not null default now(),
  primary key (user_id, reward_key)
);
alter table public.reward_claims enable row level security;
drop policy if exists "read own reward claims" on public.reward_claims;
create policy "read own reward claims"
  on public.reward_claims for select
  using (auth.uid() = user_id);
grant select on public.reward_claims to authenticated;

insert into public.lessons (
  id, slug, title, topic, description, duration_minutes, xp_reward, sort_order, is_published
) values
  ('10000000-0000-4000-8000-000000000005','glass-metal-basics','Glass and metal basics','Materials','Delaware sorting basics.',5,25,5,true),
  ('10000000-0000-4000-8000-000000000006','smarter-compost-habits','Smarter compost habits','Organic waste','Reduce contamination.',6,30,6,true)
on conflict (id) do update set
  title = excluded.title,
  topic = excluded.topic,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  xp_reward = excluded.xp_reward,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;

insert into public.lesson_answer_keys (lesson_id, correct_answer) values
  ('10000000-0000-4000-8000-000000000001', 1),
  ('10000000-0000-4000-8000-000000000002', 1),
  ('10000000-0000-4000-8000-000000000003', 1),
  ('10000000-0000-4000-8000-000000000004', 0),
  ('10000000-0000-4000-8000-000000000005', 1),
  ('10000000-0000-4000-8000-000000000006', 0)
on conflict (lesson_id) do update
  set correct_answer = excluded.correct_answer;

-- Browser users may read their own earned state, but only the server-side RPCs
-- below may mint scans, lesson completions, achievements, or XP.
drop policy if exists "own progress" on public.user_progress;
drop policy if exists "own scans" on public.scan_history;
drop policy if exists "own achievements" on public.user_achievements;
drop policy if exists "own lesson progress" on public.lesson_progress;
drop policy if exists "own quiz attempts" on public.quiz_attempts;
drop policy if exists "own quest progress" on public.quest_progress;
drop policy if exists "own corrections" on public.scan_corrections;
drop policy if exists "own notifications" on public.notifications;
drop policy if exists "own settings" on public.user_settings;
drop policy if exists "read own progress" on public.user_progress;
drop policy if exists "read own scans" on public.scan_history;
drop policy if exists "read own achievements" on public.user_achievements;
drop policy if exists "read own lesson progress" on public.lesson_progress;
drop policy if exists "read own quiz attempts" on public.quiz_attempts;
drop policy if exists "read own quest progress" on public.quest_progress;
drop policy if exists "read own corrections" on public.scan_corrections;
drop policy if exists "read own notifications" on public.notifications;
drop policy if exists "manage own settings" on public.user_settings;

create policy "read own progress" on public.user_progress
  for select using (auth.uid() = user_id);
create policy "read own scans" on public.scan_history
  for select using (auth.uid() = user_id);
create policy "read own achievements" on public.user_achievements
  for select using (auth.uid() = user_id);
create policy "read own lesson progress" on public.lesson_progress
  for select using (auth.uid() = user_id);
create policy "read own quiz attempts" on public.quiz_attempts
  for select using (auth.uid() = user_id);
create policy "read own quest progress" on public.quest_progress
  for select using (auth.uid() = user_id);
create policy "read own corrections" on public.scan_corrections
  for select using (auth.uid() = user_id);
create policy "read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "manage own settings" on public.user_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.record_ecolearn_scan(
  p_item_name text,
  p_is_recyclable boolean,
  p_confidence_score numeric,
  p_category text,
  p_instructions text,
  p_client_request_id uuid default gen_random_uuid()
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
  if p_client_request_id is null then raise exception 'Request ID required'; end if;
  if char_length(trim(coalesce(p_item_name, ''))) = 0 or char_length(p_item_name) > 160 then
    raise exception 'Invalid item name';
  end if;
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

create or replace function public.complete_ecolearn_lesson(
  p_lesson_id uuid,
  p_selected_answer integer
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
      last_activity_date = current_date,
      updated_at = now()
  where user_id = v_user
  returning * into v_progress;

  insert into public.user_achievements (user_id, achievement_id)
  select v_user, id from public.achievements
  where requirement_type = 'lessons'
    and v_progress.total_lessons_completed >= requirement_value
  on conflict do nothing;
  return v_progress;
end;
$$;

create or replace function public.claim_ecolearn_reward(p_reward_key text)
returns public.user_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_xp integer := case p_reward_key
    when 'daily_three_scans' then 15
    when 'weekend_reusable_cup' then 40
    else null
  end;
  v_progress public.user_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_xp is null then raise exception 'Unknown reward'; end if;
  insert into public.user_progress (user_id) values (v_user) on conflict do nothing;
  if p_reward_key = 'daily_three_scans'
    and (select total_scans from public.user_progress where user_id = v_user) < 3 then
    raise exception 'Complete three verified scans first';
  end if;
  insert into public.reward_claims (user_id, reward_key)
  values (v_user, p_reward_key)
  on conflict do nothing;
  if not found then
    select * into v_progress from public.user_progress where user_id = v_user;
    return v_progress;
  end if;
  update public.user_progress
  set xp = xp + v_xp,
      level = floor((xp + v_xp) / 100.0)::integer + 1,
      updated_at = now()
  where user_id = v_user
  returning * into v_progress;
  return v_progress;
end;
$$;

-- Retire the earlier browser-callable reward functions from the July migration.
revoke all on function public.record_scan(text, boolean, numeric, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_lesson(uuid)
  from public, anon, authenticated;
revoke all on function public.record_ecolearn_scan(text, boolean, numeric, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_ecolearn_lesson(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.claim_ecolearn_reward(text)
  from public, anon, authenticated;
grant execute on function public.record_ecolearn_scan(text, boolean, numeric, text, text, uuid)
  to authenticated;
grant execute on function public.complete_ecolearn_lesson(uuid, integer)
  to authenticated;
grant execute on function public.claim_ecolearn_reward(text)
  to authenticated;
