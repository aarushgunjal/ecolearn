-- Retire image feedback without destroying historical user data. Account deletion
-- retains its cleanup of legacy uploads; the browser can no longer upload or train.
do $$ begin
  if to_regclass('public.scan_feedback') is not null then
    revoke all on public.scan_feedback from anon, authenticated;
  end if;
  if to_regclass('public.training_automation_settings') is not null then
    update public.training_automation_settings set enabled = false, auto_promote = false;
    revoke all on public.training_automation_settings from anon, authenticated;
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'create policy "retired feedback uploads" on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> ''training-feedback'')';
    execute 'create policy "retired feedback updates" on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> ''training-feedback'') with check (bucket_id <> ''training-feedback'')';
  end if;
end $$;

-- An author's deletion preserves class content. Owning a space still requires
-- deleting the space before deleting the owner, avoiding orphaned management.
alter table public.ecolearn_assignments alter column created_by drop not null;
alter table public.ecolearn_assignments drop constraint ecolearn_assignments_created_by_fkey;
alter table public.ecolearn_assignments add foreign key(created_by) references auth.users(id) on delete set null;
alter table public.ecolearn_announcements alter column created_by drop not null;
alter table public.ecolearn_announcements drop constraint ecolearn_announcements_created_by_fkey;
alter table public.ecolearn_announcements add foreign key(created_by) references auth.users(id) on delete set null;
alter table public.ecolearn_community_events alter column created_by drop not null;
alter table public.ecolearn_community_events drop constraint ecolearn_community_events_created_by_fkey;
alter table public.ecolearn_community_events add foreign key(created_by) references auth.users(id) on delete set null;

create or replace function public.claim_ecolearn_reward(p_reward_key text)
returns public.user_progress language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_progress public.user_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
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
revoke all on function public.claim_ecolearn_reward(text) from public, anon;
grant execute on function public.claim_ecolearn_reward(text) to authenticated;
