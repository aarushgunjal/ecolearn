-- Reserve photo and label requests together before contacting a paid provider.
alter table public.ai_request_log drop constraint if exists ai_request_log_request_kind_check;
alter table public.ai_request_log add constraint ai_request_log_request_kind_check
  check (request_kind in ('delaware_catalog_match', 'label_read'));
create index if not exists ai_request_log_created_idx on public.ai_request_log (created_at desc);

create or replace function public.ecolearn_reserve_visual_request(
  p_user_id uuid, p_kind text, p_hourly_limit integer, p_daily_limit integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_kind is null or p_kind not in ('delaware_catalog_match', 'label_read')
     or p_hourly_limit is null or p_hourly_limit < 1 or p_hourly_limit > 1000
     or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 100000 then
    raise exception 'Invalid visual request reservation';
  end if;
  -- One transaction lock covers the shared budget, including different users.
  perform pg_advisory_xact_lock(831704221);
  if (select count(*) from public.ai_request_log where created_at > v_now - interval '24 hours') >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'code', 'GLOBAL_DAILY_LIMIT_REACHED');
  end if;
  if (select count(*) from public.ai_request_log where user_id = p_user_id and created_at > v_now - interval '1 hour') >= p_hourly_limit then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED');
  end if;
  insert into public.ai_request_log(user_id, request_kind) values (p_user_id, p_kind);
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.ecolearn_reserve_visual_request(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.ecolearn_reserve_visual_request(uuid, text, integer, integer) to service_role;
