-- Administrator privileges require a server-verified authenticator session.
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    and exists(select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.ecolearn_is_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and public.is_app_admin();
$$;

create or replace function public.is_ecolearn_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_app_admin();
$$;

-- Reports only the caller's assignment so enrollment is possible before AAL2.
create or replace function public.ecolearn_admin_access()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'is_admin', exists(select 1 from public.app_admins where user_id = auth.uid()),
    'verified', public.is_app_admin()
  );
end;
$$;
revoke all on function public.ecolearn_admin_access() from public, anon;
grant execute on function public.ecolearn_admin_access() to authenticated;
revoke all on function public.is_app_admin(), public.ecolearn_is_admin(uuid), public.is_ecolearn_admin() from public, anon;
grant execute on function public.is_app_admin(), public.ecolearn_is_admin(uuid), public.is_ecolearn_admin() to authenticated, service_role;
