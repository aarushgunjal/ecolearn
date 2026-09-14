-- Supabase can grant EXECUTE directly to anon and authenticated by default.
-- Revoking only PUBLIC does not remove those direct grants.
do $$
declare
  f record;
  p record;
  internal_only boolean;
begin
  for f in
    select oid, oid::regprocedure as signature, proname, prorettype
    from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
  loop
    internal_only := f.prorettype = 'trigger'::regtype or f.proname in (
      'award_eligible_achievements', 'ecolearn_make_join_code',
      'ecolearn_users_share_space', 'ecolearn_notification_allowed',
      'enqueue_training_batch', 'claim_next_training_batch', 'finish_training_batch',
      'ecolearn_enqueue_reminders', 'ecolearn_claim_deliveries'
    );
    -- Preserve existing authenticated API access without exposing internal helpers.
    if not internal_only and has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
    execute format('revoke all on function %s from public, anon', f.signature);
    if internal_only then
      execute format('revoke all on function %s from authenticated', f.signature);
    end if;
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;

  -- Private-table policies should never execute permission helpers for guests.
  -- The four public learning/reference catalogs retain guest read access.
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and roles = array['public']::name[]
      and tablename not in ('lessons', 'achievements', 'municipalities', 'quests')
  loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end;
$$;

-- New API functions must explicitly grant the roles that should call them.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
