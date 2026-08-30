-- Production community and classroom system.
-- This supersedes the intentionally disabled 202608200001 scaffold with
-- membership-scoped RLS and security-definer RPCs. Join codes are never
-- exposed through public discovery queries.

create extension if not exists pgcrypto;

create table if not exists public.ecolearn_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_role text not null default 'student' check (account_role in ('student', 'teacher')),
  public_alias text not null default 'Eco learner' check (char_length(public_alias) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecolearn_communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  kind text not null check (kind in ('school', 'neighborhood', 'faith', 'club', 'organization', 'municipality')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.ecolearn_community_members (
  community_id uuid not null references public.ecolearn_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'manager', 'member')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.ecolearn_classrooms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.ecolearn_communities(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  grade_label text not null default '' check (char_length(grade_label) <= 40),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (community_id, name)
);

create table if not exists public.ecolearn_classroom_members (
  classroom_id uuid not null references public.ecolearn_classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  classroom_role text not null default 'student' check (classroom_role in ('teacher', 'student')),
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table if not exists public.ecolearn_join_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 8 and 20),
  community_id uuid references public.ecolearn_communities(id) on delete cascade,
  classroom_id uuid references public.ecolearn_classrooms(id) on delete cascade,
  access_role text not null check (access_role in ('member', 'student', 'teacher')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  check ((community_id is not null)::integer + (classroom_id is not null)::integer = 1)
);

create table if not exists public.ecolearn_assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.ecolearn_classrooms(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (classroom_id, lesson_id, due_at)
);

create table if not exists public.ecolearn_announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.ecolearn_communities(id) on delete cascade,
  classroom_id uuid references public.ecolearn_classrooms(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 2 and 1200),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((community_id is not null)::integer + (classroom_id is not null)::integer = 1)
);

create table if not exists public.ecolearn_community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.ecolearn_communities(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1200),
  starts_at timestamptz not null,
  location text not null default '' check (char_length(location) <= 200),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ecolearn_event_rsvps (
  event_id uuid not null references public.ecolearn_community_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists ecolearn_community_members_user_idx on public.ecolearn_community_members(user_id);
create index if not exists ecolearn_classrooms_community_idx on public.ecolearn_classrooms(community_id);
create index if not exists ecolearn_classroom_members_user_idx on public.ecolearn_classroom_members(user_id);
create index if not exists ecolearn_assignments_classroom_idx on public.ecolearn_assignments(classroom_id, due_at);
create index if not exists ecolearn_announcements_community_idx on public.ecolearn_announcements(community_id, created_at desc);
create index if not exists ecolearn_announcements_classroom_idx on public.ecolearn_announcements(classroom_id, created_at desc);
create index if not exists ecolearn_events_community_idx on public.ecolearn_community_events(community_id, starts_at);

insert into public.ecolearn_profiles (user_id, public_alias)
select id, case
  when char_length(trim(coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', '')))) between 2 and 40
    then trim(coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', '')))
  else 'Eco learner'
end
from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_ecolearn_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ecolearn_profiles (user_id, public_alias)
  values (new.id, case
    when char_length(trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', '')))) between 2 and 40
      then trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', '')))
    else 'Eco learner'
  end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ecolearn_profile on auth.users;
create trigger on_auth_user_created_ecolearn_profile
after insert on auth.users
for each row execute procedure public.handle_new_ecolearn_profile();

create or replace function public.ecolearn_is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.app_admins where user_id = p_user_id
  );
$$;

create or replace function public.ecolearn_effective_role()
returns text
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select case
    when public.ecolearn_is_admin(auth.uid()) then 'admin'
    else coalesce((select account_role from public.ecolearn_profiles where user_id = auth.uid()), 'student')
  end;
$$;

create or replace function public.ecolearn_is_community_member(p_community_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.ecolearn_community_members
    where community_id = p_community_id and user_id = p_user_id
  );
$$;

create or replace function public.ecolearn_can_manage_community(p_community_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id = auth.uid() and (public.ecolearn_is_admin(p_user_id) or exists (
    select 1 from public.ecolearn_community_members
    where community_id = p_community_id and user_id = p_user_id and member_role in ('owner', 'manager')
  ));
$$;

create or replace function public.ecolearn_is_classroom_member(p_classroom_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.ecolearn_classroom_members
    where classroom_id = p_classroom_id and user_id = p_user_id
  );
$$;

create or replace function public.ecolearn_can_manage_classroom(p_classroom_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id = auth.uid() and (public.ecolearn_is_admin(p_user_id)
    or exists (
      select 1 from public.ecolearn_classroom_members
      where classroom_id = p_classroom_id and user_id = p_user_id and classroom_role = 'teacher'
    )
    or exists (
      select 1 from public.ecolearn_classrooms c
      where c.id = p_classroom_id and public.ecolearn_can_manage_community(c.community_id, p_user_id)
    ));
$$;

alter table public.ecolearn_profiles enable row level security;
alter table public.ecolearn_communities enable row level security;
alter table public.ecolearn_community_members enable row level security;
alter table public.ecolearn_classrooms enable row level security;
alter table public.ecolearn_classroom_members enable row level security;
alter table public.ecolearn_join_codes enable row level security;
alter table public.ecolearn_assignments enable row level security;
alter table public.ecolearn_announcements enable row level security;
alter table public.ecolearn_community_events enable row level security;
alter table public.ecolearn_event_rsvps enable row level security;

revoke all on public.ecolearn_profiles, public.ecolearn_communities, public.ecolearn_community_members,
  public.ecolearn_classrooms, public.ecolearn_classroom_members, public.ecolearn_join_codes,
  public.ecolearn_assignments, public.ecolearn_announcements, public.ecolearn_community_events,
  public.ecolearn_event_rsvps from anon, authenticated;

grant select on public.ecolearn_profiles, public.ecolearn_communities, public.ecolearn_community_members,
  public.ecolearn_classrooms, public.ecolearn_classroom_members, public.ecolearn_join_codes,
  public.ecolearn_assignments, public.ecolearn_announcements, public.ecolearn_community_events,
  public.ecolearn_event_rsvps to authenticated;

drop policy if exists "users read own ecolearn profile" on public.ecolearn_profiles;
create policy "users read own ecolearn profile" on public.ecolearn_profiles for select
using (user_id = auth.uid() or public.ecolearn_is_admin());

drop policy if exists "members read communities" on public.ecolearn_communities;
create policy "members read communities" on public.ecolearn_communities for select
using (public.ecolearn_is_community_member(id) or public.ecolearn_is_admin());

drop policy if exists "members read own memberships" on public.ecolearn_community_members;
create policy "members read own memberships" on public.ecolearn_community_members for select
using (user_id = auth.uid() or public.ecolearn_can_manage_community(community_id) or public.ecolearn_is_admin());

drop policy if exists "members read classrooms" on public.ecolearn_classrooms;
create policy "members read classrooms" on public.ecolearn_classrooms for select
using (public.ecolearn_is_classroom_member(id) or public.ecolearn_is_community_member(community_id) or public.ecolearn_is_admin());

drop policy if exists "classroom roster privacy" on public.ecolearn_classroom_members;
create policy "classroom roster privacy" on public.ecolearn_classroom_members for select
using (user_id = auth.uid() or public.ecolearn_can_manage_classroom(classroom_id) or public.ecolearn_is_admin());

drop policy if exists "classroom members read assignments" on public.ecolearn_assignments;
create policy "classroom members read assignments" on public.ecolearn_assignments for select
using (public.ecolearn_is_classroom_member(classroom_id) or public.ecolearn_can_manage_classroom(classroom_id) or public.ecolearn_is_admin());

drop policy if exists "managers read join codes" on public.ecolearn_join_codes;
create policy "managers read join codes" on public.ecolearn_join_codes for select
using (
  (community_id is not null and public.ecolearn_can_manage_community(community_id))
  or (classroom_id is not null and public.ecolearn_can_manage_classroom(classroom_id))
  or public.ecolearn_is_admin()
);

drop policy if exists "members read announcements" on public.ecolearn_announcements;
create policy "members read announcements" on public.ecolearn_announcements for select
using (
  (community_id is not null and public.ecolearn_is_community_member(community_id))
  or (classroom_id is not null and public.ecolearn_is_classroom_member(classroom_id))
  or public.ecolearn_is_admin()
);

drop policy if exists "members read events" on public.ecolearn_community_events;
create policy "members read events" on public.ecolearn_community_events for select
using (public.ecolearn_is_community_member(community_id) or public.ecolearn_is_admin());

drop policy if exists "members read event rsvps" on public.ecolearn_event_rsvps;
create policy "members read event rsvps" on public.ecolearn_event_rsvps for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.ecolearn_community_events e
    where e.id = event_id and public.ecolearn_can_manage_community(e.community_id)
  )
  or public.ecolearn_is_admin()
);

create or replace function public.ecolearn_make_join_code(p_prefix text)
returns text
language plpgsql volatile security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(left(regexp_replace(p_prefix, '[^A-Za-z]', '', 'g'), 4)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
    exit when not exists (select 1 from public.ecolearn_join_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.ecolearn_set_profile(p_alias text, p_role text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_alias text := trim(coalesce(p_alias, ''));
  v_role text := lower(trim(coalesce(p_role, '')));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if char_length(v_alias) < 2 or char_length(v_alias) > 40 then raise exception 'Choose an alias between 2 and 40 characters'; end if;
  if v_role not in ('student', 'teacher') then raise exception 'Choose student or teacher access'; end if;
  if v_role = 'teacher'
    and not public.ecolearn_is_admin(v_user)
    and coalesce((select account_role from public.ecolearn_profiles where user_id = v_user), 'student') <> 'teacher'
    and not exists (select 1 from public.ecolearn_classroom_members where user_id = v_user and classroom_role = 'teacher')
  then raise exception 'Teacher access requires a private teacher invitation or administrator approval'; end if;
  if v_role = 'student' and exists (
    select 1 from public.ecolearn_community_members where user_id = v_user and member_role in ('owner', 'manager')
  ) then raise exception 'Transfer management of your communities before changing to student access'; end if;
  insert into public.ecolearn_profiles (user_id, account_role, public_alias, updated_at)
  values (v_user, v_role, v_alias, now())
  on conflict (user_id) do update set account_role = excluded.account_role, public_alias = excluded.public_alias, updated_at = now();
  return jsonb_build_object('user_id', v_user, 'role', v_role, 'alias', v_alias);
end;
$$;

create or replace function public.ecolearn_create_community(p_name text, p_kind text, p_description text default '')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_community public.ecolearn_communities;
  v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.ecolearn_effective_role() not in ('teacher', 'admin') then raise exception 'Teacher access is required to create a community'; end if;
  insert into public.ecolearn_communities (name, description, kind, created_by)
  values (trim(p_name), trim(coalesce(p_description, '')), lower(trim(p_kind)), v_user)
  returning * into v_community;
  insert into public.ecolearn_community_members (community_id, user_id, member_role)
  values (v_community.id, v_user, 'owner');
  v_code := public.ecolearn_make_join_code(case when v_community.kind = 'school' then 'SCH' else 'COM' end);
  insert into public.ecolearn_join_codes (code, community_id, access_role, created_by)
  values (v_code, v_community.id, 'member', v_user);
  return jsonb_build_object('id', v_community.id, 'name', v_community.name, 'kind', v_community.kind, 'join_code', v_code);
end;
$$;

create or replace function public.ecolearn_create_classroom(p_community_id uuid, p_name text, p_grade_label text default '')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_classroom public.ecolearn_classrooms;
  v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.ecolearn_effective_role() not in ('teacher', 'admin') then raise exception 'Teacher access is required to create a classroom'; end if;
  if not public.ecolearn_can_manage_community(p_community_id, v_user) then raise exception 'Community manager access is required'; end if;
  if not exists (select 1 from public.ecolearn_communities where id = p_community_id and kind = 'school' and archived_at is null) then
    raise exception 'Classrooms must belong to a school community';
  end if;
  insert into public.ecolearn_classrooms (community_id, name, grade_label, created_by)
  values (p_community_id, trim(p_name), trim(coalesce(p_grade_label, '')), v_user)
  returning * into v_classroom;
  insert into public.ecolearn_classroom_members (classroom_id, user_id, classroom_role)
  values (v_classroom.id, v_user, 'teacher');
  v_code := public.ecolearn_make_join_code('CLS');
  insert into public.ecolearn_join_codes (code, classroom_id, access_role, created_by)
  values (v_code, v_classroom.id, 'student', v_user);
  return jsonb_build_object('id', v_classroom.id, 'name', v_classroom.name, 'grade_label', v_classroom.grade_label, 'join_code', v_code);
end;
$$;

create or replace function public.ecolearn_rotate_join_code(p_scope text, p_scope_id uuid, p_access_role text default null)
returns text
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_role text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_scope = 'community' then
    if not public.ecolearn_can_manage_community(p_scope_id, v_user) then raise exception 'Manager access required'; end if;
    v_role := 'member';
    update public.ecolearn_join_codes set active = false where community_id = p_scope_id and access_role = v_role;
    v_code := public.ecolearn_make_join_code('COM');
    insert into public.ecolearn_join_codes (code, community_id, access_role, created_by) values (v_code, p_scope_id, v_role, v_user);
  elsif p_scope = 'classroom' then
    if not public.ecolearn_can_manage_classroom(p_scope_id, v_user) then raise exception 'Teacher access required'; end if;
    v_role := case when p_access_role = 'teacher' then 'teacher' else 'student' end;
    update public.ecolearn_join_codes set active = false where classroom_id = p_scope_id and access_role = v_role;
    v_code := public.ecolearn_make_join_code(case when v_role = 'teacher' then 'TCH' else 'CLS' end);
    insert into public.ecolearn_join_codes (code, classroom_id, access_role, created_by) values (v_code, p_scope_id, v_role, v_user);
  else
    raise exception 'Choose community or classroom';
  end if;
  return v_code;
end;
$$;

create or replace function public.ecolearn_join_space(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_join public.ecolearn_join_codes;
  v_community_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_join from public.ecolearn_join_codes
  where code = upper(trim(p_code)) and active = true and (expires_at is null or expires_at > now())
  for update;
  if not found then raise exception 'That join code is invalid or expired'; end if;
  if v_join.community_id is not null then
    insert into public.ecolearn_community_members (community_id, user_id, member_role)
    values (v_join.community_id, v_user, 'member') on conflict do nothing;
    return jsonb_build_object('scope', 'community', 'id', v_join.community_id);
  end if;
  select community_id into v_community_id from public.ecolearn_classrooms where id = v_join.classroom_id and archived_at is null;
  if v_community_id is null then raise exception 'That classroom is unavailable'; end if;
  if v_join.access_role = 'teacher' then
    insert into public.ecolearn_profiles (user_id, account_role, public_alias, updated_at)
    values (v_user, 'teacher', coalesce((select public_alias from public.ecolearn_profiles where user_id = v_user), 'Eco learner'), now())
    on conflict (user_id) do update set account_role = 'teacher', updated_at = now();
  end if;
  insert into public.ecolearn_community_members (community_id, user_id, member_role)
  values (v_community_id, v_user, 'member') on conflict do nothing;
  insert into public.ecolearn_classroom_members (classroom_id, user_id, classroom_role)
  values (v_join.classroom_id, v_user, case when v_join.access_role = 'teacher' then 'teacher' else 'student' end)
  on conflict (classroom_id, user_id) do update set classroom_role = excluded.classroom_role;
  return jsonb_build_object('scope', 'classroom', 'id', v_join.classroom_id, 'community_id', v_community_id);
end;
$$;

create or replace function public.ecolearn_leave_space(p_scope text, p_scope_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_scope = 'classroom' then
    delete from public.ecolearn_classroom_members where classroom_id = p_scope_id and user_id = v_user and classroom_role <> 'teacher';
  elsif p_scope = 'community' then
    if exists (select 1 from public.ecolearn_community_members where community_id = p_scope_id and user_id = v_user and member_role in ('owner', 'manager')) then
      raise exception 'Transfer community management before leaving';
    end if;
    delete from public.ecolearn_classroom_members cm using public.ecolearn_classrooms c
      where cm.classroom_id = c.id and c.community_id = p_scope_id and cm.user_id = v_user and cm.classroom_role <> 'teacher';
    delete from public.ecolearn_community_members where community_id = p_scope_id and user_id = v_user;
  else
    raise exception 'Choose community or classroom';
  end if;
end;
$$;

create or replace function public.ecolearn_create_assignment(p_classroom_id uuid, p_lesson_id uuid, p_title text, p_due_at timestamptz default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if not public.ecolearn_can_manage_classroom(p_classroom_id, v_user) then raise exception 'Teacher access required'; end if;
  if not exists (select 1 from public.lessons where id = p_lesson_id and is_published = true) then raise exception 'Choose a published lesson'; end if;
  insert into public.ecolearn_assignments (classroom_id, lesson_id, title, due_at, created_by)
  values (p_classroom_id, p_lesson_id, trim(p_title), p_due_at, v_user)
  returning id into v_id;
  return v_id;
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
  if p_scope = 'community' then
    if not public.ecolearn_can_manage_community(p_scope_id, v_user) then raise exception 'Manager access required'; end if;
    insert into public.ecolearn_announcements (community_id, title, body, created_by) values (p_scope_id, trim(p_title), trim(p_body), v_user) returning id into v_id;
  elsif p_scope = 'classroom' then
    if not public.ecolearn_can_manage_classroom(p_scope_id, v_user) then raise exception 'Teacher access required'; end if;
    insert into public.ecolearn_announcements (classroom_id, title, body, created_by) values (p_scope_id, trim(p_title), trim(p_body), v_user) returning id into v_id;
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
  if not public.ecolearn_can_manage_community(p_community_id, v_user) then raise exception 'Manager access required'; end if;
  insert into public.ecolearn_community_events (community_id, title, description, starts_at, location, created_by)
  values (p_community_id, trim(p_title), trim(coalesce(p_description, '')), p_starts_at, trim(coalesce(p_location, '')), v_user)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ecolearn_rsvp_event(p_event_id uuid, p_status text default 'going')
returns void
language plpgsql security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_community uuid; v_user uuid := auth.uid();
begin
  select community_id into v_community from public.ecolearn_community_events where id = p_event_id;
  if not public.ecolearn_is_community_member(v_community, v_user) then raise exception 'Community membership required'; end if;
  insert into public.ecolearn_event_rsvps (event_id, user_id, status) values (p_event_id, v_user, lower(p_status))
  on conflict (event_id, user_id) do update set status = excluded.status;
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
        'scope', case when a.classroom_id is null then 'community' else 'classroom' end,
        'scope_id', coalesce(a.classroom_id, a.community_id)
      ) order by a.created_at desc)
      from (select * from public.ecolearn_announcements where
        (community_id is not null and public.ecolearn_is_community_member(community_id, v_user))
        or (classroom_id is not null and public.ecolearn_is_classroom_member(classroom_id, v_user))
        order by created_at desc limit 20) a
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'community_id', e.community_id, 'title', e.title, 'description', e.description,
        'starts_at', e.starts_at, 'location', e.location,
        'rsvp_count', (select count(*) from public.ecolearn_event_rsvps r where r.event_id = e.id),
        'rsvped', exists (select 1 from public.ecolearn_event_rsvps r where r.event_id = e.id and r.user_id = v_user)
      ) order by e.starts_at)
      from public.ecolearn_community_events e
      where e.starts_at >= now() - interval '1 day' and public.ecolearn_is_community_member(e.community_id, v_user)
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
    left join public.user_progress p on p.user_id = m.user_id
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
        count(m.user_id)::integer as student_count,
        coalesce(sum(p.xp), 0)::integer as total_xp,
        coalesce(sum(p.total_scans), 0)::integer as total_scans,
        coalesce(sum(p.total_lessons_completed), 0)::integer as lesson_completions
      from public.ecolearn_classrooms c
      left join public.ecolearn_classroom_members m on m.classroom_id = c.id and m.classroom_role = 'student'
      left join public.user_progress p on p.user_id = m.user_id
      where c.community_id = p_community_id and c.archived_at is null
      group by c.id, c.name, c.grade_label
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.handle_new_ecolearn_profile(),
  public.ecolearn_is_admin(uuid), public.ecolearn_effective_role(),
  public.ecolearn_is_community_member(uuid, uuid), public.ecolearn_can_manage_community(uuid, uuid),
  public.ecolearn_is_classroom_member(uuid, uuid), public.ecolearn_can_manage_classroom(uuid, uuid),
  public.ecolearn_make_join_code(text), public.ecolearn_set_profile(text, text),
  public.ecolearn_create_community(text, text, text), public.ecolearn_create_classroom(uuid, text, text),
  public.ecolearn_rotate_join_code(text, uuid, text), public.ecolearn_join_space(text),
  public.ecolearn_leave_space(text, uuid), public.ecolearn_create_assignment(uuid, uuid, text, timestamptz),
  public.ecolearn_create_announcement(text, uuid, text, text),
  public.ecolearn_create_event(uuid, text, text, timestamptz, text),
  public.ecolearn_rsvp_event(uuid, text), public.ecolearn_get_hub(),
  public.ecolearn_get_classroom_dashboard(uuid), public.ecolearn_get_school_standings(uuid)
from public;

grant execute on function public.ecolearn_is_admin(uuid), public.ecolearn_effective_role(),
  public.ecolearn_is_community_member(uuid, uuid), public.ecolearn_can_manage_community(uuid, uuid),
  public.ecolearn_is_classroom_member(uuid, uuid), public.ecolearn_can_manage_classroom(uuid, uuid),
  public.ecolearn_set_profile(text, text),
  public.ecolearn_create_community(text, text, text), public.ecolearn_create_classroom(uuid, text, text),
  public.ecolearn_rotate_join_code(text, uuid, text), public.ecolearn_join_space(text),
  public.ecolearn_leave_space(text, uuid), public.ecolearn_create_assignment(uuid, uuid, text, timestamptz),
  public.ecolearn_create_announcement(text, uuid, text, text),
  public.ecolearn_create_event(uuid, text, text, timestamptz, text),
  public.ecolearn_rsvp_event(uuid, text), public.ecolearn_get_hub(),
  public.ecolearn_get_classroom_dashboard(uuid), public.ecolearn_get_school_standings(uuid)
to authenticated;
