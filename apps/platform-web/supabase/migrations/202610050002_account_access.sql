begin;
-- Existing educators keep access. New accounts start as students regardless of
-- untrusted signup metadata. A private teacher invitation also grants access.
create table public.ecolearn_teacher_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization text not null check (char_length(organization) between 2 and 120),
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.ecolearn_teacher_requests enable row level security;
revoke all on public.ecolearn_teacher_requests from public, anon, authenticated;
grant select on public.ecolearn_teacher_requests to authenticated;
create policy "own teacher request or verified administrator" on public.ecolearn_teacher_requests for select to authenticated
using (user_id = auth.uid() or public.ecolearn_is_admin());

create or replace function public.handle_new_ecolearn_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.ecolearn_profiles(user_id, account_role, public_alias)
  values(new.id, 'student', 'Eco learner') on conflict do nothing;
  return new;
end; $$;

create or replace function public.ecolearn_request_teacher_access(p_organization text, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.ecolearn_effective_role() <> 'student' then raise exception 'You already have educator access'; end if;
  if char_length(trim(coalesce(p_organization,''))) not between 2 and 120
    or char_length(trim(coalesce(p_reason,''))) not between 10 and 1000 then
    raise exception 'Enter your school or organization and a short explanation of your teaching role';
  end if;
  insert into public.ecolearn_teacher_requests(user_id, organization, reason)
  values(auth.uid(), trim(p_organization), trim(p_reason))
  on conflict(user_id) do update set organization=excluded.organization, reason=excluded.reason,
    status='pending', created_at=now(), reviewed_at=null, reviewed_by=null
    where ecolearn_teacher_requests.status in ('declined','withdrawn');
  if not found then raise exception 'Your request is already awaiting review'; end if;
end; $$;

create or replace function public.ecolearn_review_teacher_access(p_user_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ecolearn_is_admin() then raise exception 'Verified administrator access required'; end if;
  if p_user_id = auth.uid() or p_approve is null then raise exception 'Choose another educator and a review decision'; end if;
  update public.ecolearn_teacher_requests set status=case when p_approve then 'approved' else 'declined' end,
    reviewed_by=auth.uid(), reviewed_at=now() where user_id=p_user_id and status='pending';
  if not found then raise exception 'This request is no longer pending'; end if;
  if p_approve then update public.ecolearn_profiles set account_role='teacher', updated_at=now() where user_id=p_user_id; end if;
  insert into public.notifications(user_id,title,body,kind,target_path,dedupe_key)
  values(p_user_id, case when p_approve then 'Teacher access approved' else 'Teacher request reviewed' end,
    case when p_approve then 'You can now create and manage learning spaces.' else 'Your request was not approved. Check your details in account settings before requesting again.' end,
    'system', '/profile', 'teacher-review:' || gen_random_uuid());
end; $$;

create or replace function public.ecolearn_set_profile(p_alias text, p_role text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp set row_security = off as $$
declare v_user uuid := auth.uid(); v_alias text := trim(coalesce(p_alias,'')); v_role text := lower(trim(coalesce(p_role,''))); v_current text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if char_length(v_alias) not between 2 and 40 then raise exception 'Choose an alias between 2 and 40 characters'; end if;
  if v_role not in ('student','teacher') then raise exception 'Choose student or teacher access'; end if;
  select account_role into v_current from public.ecolearn_profiles where user_id=v_user for update;
  if v_role='teacher' and coalesce(v_current,'student') <> 'teacher' and not public.ecolearn_is_admin() then
    raise exception 'Teacher access requires an approved request or a private teacher invitation. Open Account settings to request access.';
  end if;
  if v_role='student' and v_current='teacher' and (
    exists(select 1 from public.ecolearn_community_members m join public.ecolearn_communities c on c.id=m.community_id
      where m.user_id=v_user and m.member_role in ('owner','manager') and c.archived_at is null)
    or exists(select 1 from public.ecolearn_classroom_members m join public.ecolearn_classrooms c on c.id=m.classroom_id
      join public.ecolearn_communities s on s.id=c.community_id where m.user_id=v_user and m.classroom_role='teacher'
      and c.archived_at is null and s.archived_at is null)
  ) then raise exception 'Leave or delete the active spaces you manage before changing to a student account. Use student preview to try the learner view without changing your account.'; end if;
  insert into public.ecolearn_profiles(user_id,account_role,public_alias,updated_at) values(v_user,v_role,v_alias,now())
  on conflict(user_id) do update set account_role=excluded.account_role,public_alias=excluded.public_alias,updated_at=now();
  if v_role='student' and v_current='teacher' then
    update public.ecolearn_teacher_requests set status='withdrawn' where user_id=v_user;
  end if;
  return jsonb_build_object('user_id',v_user,'role',v_role,'alias',v_alias);
end; $$;

-- Recovery must not silently resurrect teacher powers after an account change.
create or replace function public.ecolearn_restore_space(p_scope text, p_scope_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.ecolearn_effective_role() not in ('teacher','admin') then raise exception 'Teacher access is required to restore managed spaces'; end if;
  if not public.ecolearn_can_delete_space(p_scope,p_scope_id) then raise exception 'Only the owner or an authorized administrator can restore this space'; end if;
  if p_scope='community' then
    update public.ecolearn_communities set archived_at=null,delete_after=null where id=p_scope_id and delete_after>now();
  elsif p_scope='classroom' then
    update public.ecolearn_classrooms set archived_at=null,delete_after=null where id=p_scope_id and delete_after>now()
      and exists(select 1 from public.ecolearn_communities s where s.id=community_id and s.archived_at is null);
  else raise exception 'Choose community or classroom'; end if;
  if not found then raise exception 'The recovery period has expired, or the parent community must be restored first'; end if;
end; $$;

revoke all on function public.ecolearn_request_teacher_access(text,text),public.ecolearn_review_teacher_access(uuid,boolean) from public,anon;
grant execute on function public.ecolearn_request_teacher_access(text,text),public.ecolearn_review_teacher_access(uuid,boolean) to authenticated;
create or replace function public.ecolearn_can_manage_community(p_community_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and public.ecolearn_effective_role() in ('teacher','admin') and exists (
    select 1 from public.ecolearn_communities c where c.id = p_community_id and c.archived_at is null
    and (public.ecolearn_is_admin(p_user_id) or exists (
      select 1 from public.ecolearn_community_members m where m.community_id = c.id and m.user_id = p_user_id and m.member_role in ('owner','manager')
    ))
  );
$$;

create or replace function public.ecolearn_can_manage_classroom(p_classroom_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp set row_security = off as $$
  select p_user_id = auth.uid() and public.ecolearn_effective_role() in ('teacher','admin') and exists (
    select 1 from public.ecolearn_classrooms c join public.ecolearn_communities s on s.id = c.community_id
    where c.id = p_classroom_id and c.archived_at is null and s.archived_at is null
    and (public.ecolearn_can_manage_community(c.community_id, p_user_id) or exists (
      select 1 from public.ecolearn_classroom_members m where m.classroom_id = c.id and m.user_id = p_user_id and m.classroom_role = 'teacher'
    ))
  );
$$;

commit;
