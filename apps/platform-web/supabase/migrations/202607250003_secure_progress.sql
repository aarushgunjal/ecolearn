-- Never trust a browser to award XP or decide that a lesson is complete.
-- These RPCs make progress updates atomic and derive every reward server-side.

drop policy if exists "own progress" on public.user_progress;
create policy "read own progress" on public.user_progress for select using (auth.uid() = user_id);
drop policy if exists "own scans" on public.scan_history;
create policy "read own scans" on public.scan_history for select using (auth.uid() = user_id);
drop policy if exists "own achievements" on public.user_achievements;
create policy "read own achievements" on public.user_achievements for select using (auth.uid() = user_id);
drop policy if exists "own lesson progress" on public.lesson_progress;
create policy "read own lesson progress" on public.lesson_progress for select using (auth.uid() = user_id);

create or replace function public.award_eligible_achievements(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.user_achievements (user_id, achievement_id)
  select p_user_id, a.id
  from public.achievements a
  cross join public.user_progress p
  where p.user_id = p_user_id
    and ((a.requirement_type = 'scans' and p.total_scans >= a.requirement_value)
      or (a.requirement_type = 'lessons' and p.total_lessons_completed >= a.requirement_value)
      or (a.requirement_type = 'streak' and p.streak_days >= a.requirement_value)
      or (a.requirement_type = 'level' and p.level >= a.requirement_value))
  on conflict do nothing;
$$;

create or replace function public.record_scan(
  p_item_name text, p_is_recyclable boolean, p_confidence numeric,
  p_category text, p_instructions text
) returns public.user_progress language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_progress public.user_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_item_name, ''))) not between 1 and 160 then raise exception 'Invalid item name'; end if;
  if p_confidence is not null and (p_confidence < 0 or p_confidence > 100) then raise exception 'Invalid confidence'; end if;
  insert into public.scan_history (user_id,item_name,is_recyclable,confidence_score,category,instructions)
  values (v_user, trim(p_item_name), p_is_recyclable, p_confidence, left(coalesce(p_category,''),120), left(coalesce(p_instructions,''),1000));
  update public.user_progress set
    total_scans = total_scans + 1,
    xp = xp + 10,
    level = floor((xp + 10) / 100.0)::integer + 1,
    streak_days = case when last_activity_date = current_date - 1 then streak_days + 1 when last_activity_date = current_date then streak_days else 1 end,
    last_activity_date = current_date,
    updated_at = now()
  where user_id = v_user returning * into v_progress;
  perform public.award_eligible_achievements(v_user);
  return v_progress;
end; $$;

create or replace function public.complete_lesson(p_lesson_id uuid)
returns public.user_progress language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_xp integer; v_inserted integer; v_progress public.user_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select xp_reward into v_xp from public.lessons where id = p_lesson_id and is_published;
  if v_xp is null then raise exception 'Lesson unavailable'; end if;
  insert into public.lesson_progress (user_id,lesson_id,status,completed_at)
  values (v_user,p_lesson_id,'completed',now()) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then select * into v_progress from public.user_progress where user_id = v_user; return v_progress; end if;
  update public.user_progress set xp = xp + v_xp, level = floor((xp + v_xp) / 100.0)::integer + 1,
    total_lessons_completed = total_lessons_completed + 1, last_activity_date = current_date, updated_at = now()
  where user_id = v_user returning * into v_progress;
  perform public.award_eligible_achievements(v_user);
  return v_progress;
end; $$;

revoke all on function public.award_eligible_achievements(uuid) from public;
grant execute on function public.record_scan(text,boolean,numeric,text,text) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
