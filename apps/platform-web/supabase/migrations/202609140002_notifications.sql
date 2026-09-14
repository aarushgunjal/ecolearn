-- A shared inbox with opt-in delivery. No client can create notifications or send mail.
alter table public.notifications add column if not exists dedupe_key text;
alter table public.notifications add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.notifications add column if not exists source_id uuid;
alter table public.notifications add column if not exists target_path text not null default '/notifications';
alter table public.notifications add column if not exists community_id uuid references public.ecolearn_communities(id) on delete cascade;
alter table public.notifications add column if not exists classroom_id uuid references public.ecolearn_classrooms(id) on delete cascade;
create unique index if not exists notifications_dedupe on public.notifications(user_id, dedupe_key);
create index if not exists notifications_inbox on public.notifications(user_id, created_at desc);

create table public.ecolearn_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  streak_reminders boolean not null default true,
  learning_updates boolean not null default true,
  community_updates boolean not null default true,
  timezone text not null default 'America/New_York',
  reminder_hour integer not null default 18 check (reminder_hour between 0 and 23)
);
create table public.ecolearn_push_devices (
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index ecolearn_push_devices_user on public.ecolearn_push_devices(user_id);
-- Preserve opt-outs from the former single profile switch.
insert into public.ecolearn_notification_preferences(user_id, streak_reminders, learning_updates, community_updates)
select user_id, false, false, false from public.user_settings where not notifications_enabled
on conflict do nothing;
create table public.ecolearn_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  destination text not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  delivered_at timestamptz,
  provider_id text,
  last_error text,
  unique(notification_id, channel, destination)
);
create index ecolearn_deliveries_pending on public.ecolearn_notification_deliveries(available_at) where delivered_at is null;
alter table public.ecolearn_notification_preferences enable row level security;
alter table public.ecolearn_push_devices enable row level security;
alter table public.ecolearn_notification_deliveries enable row level security;
revoke all on public.ecolearn_notification_preferences, public.ecolearn_push_devices, public.ecolearn_notification_deliveries from anon, authenticated;
grant select on public.ecolearn_notification_preferences to authenticated;
create policy "own notification preferences" on public.ecolearn_notification_preferences for select to authenticated using(user_id = auth.uid());
grant all on public.ecolearn_notification_preferences, public.ecolearn_push_devices, public.ecolearn_notification_deliveries to service_role;
-- Replace any old broad notification write grants. Read/mark operations remain scoped.
revoke insert, update, delete on public.notifications from anon, authenticated;

create or replace function public.ecolearn_set_notification_preferences(
  p_email boolean, p_push boolean, p_streak boolean, p_learning boolean,
  p_community boolean, p_timezone text, p_hour integer
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_timezone) then raise exception 'Choose a valid timezone'; end if;
  insert into public.ecolearn_notification_preferences values(auth.uid(), p_email, p_push, p_streak, p_learning, p_community, p_timezone, p_hour)
  on conflict(user_id) do update set email_enabled = p_email, push_enabled = p_push, streak_reminders = p_streak,
    learning_updates = p_learning, community_updates = p_community, timezone = p_timezone, reminder_hour = p_hour;
end; $$;

create or replace function public.ecolearn_mark_notifications_read(p_id uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
end; $$;

create or replace function public.ecolearn_register_push_device(p_token text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_remove then delete from public.ecolearn_push_devices where token = p_token and user_id = auth.uid();
  else
    insert into public.ecolearn_push_devices(token, user_id) values(p_token, auth.uid())
    on conflict(token) do update set user_id = auth.uid(), updated_at = now();
  end if;
end; $$;

-- Check both scope access and current preferences at enqueue AND delivery time.
create or replace function public.ecolearn_notification_allowed(p public.notifications)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (p.classroom_id is null or exists(select 1 from public.ecolearn_classroom_members where classroom_id = p.classroom_id and user_id = p.user_id))
    and (p.community_id is null or exists(select 1 from public.ecolearn_community_members where community_id = p.community_id and user_id = p.user_id))
    and not exists(select 1 from public.ecolearn_blocked_users where blocker_user_id = p.user_id and blocked_user_id = p.actor_id)
    and (p.kind <> 'announcement' or exists(select 1 from public.ecolearn_announcements where id = p.source_id and removed_at is null))
    and (p.kind <> 'event' or exists(select 1 from public.ecolearn_community_events where id = p.source_id and removed_at is null))
    and (p.kind not in ('assignment','due') or exists(select 1 from public.ecolearn_assignments where id = p.source_id))
    and (p.kind <> 'due' or exists(select 1 from public.ecolearn_assignments a where a.id = p.source_id and a.due_at > now()
      and not exists(select 1 from public.lesson_progress lp where lp.user_id = p.user_id and lp.lesson_id = a.lesson_id and lp.status = 'completed')))
    and (p.kind <> 'streak' or exists(select 1 from public.user_progress where user_id = p.user_id and last_activity_date = current_date - 1))
    and coalesce((select case when p.kind = 'streak' then streak_reminders when p.kind in ('assignment','due') then learning_updates else community_updates end
      from public.ecolearn_notification_preferences where user_id = p.user_id), true);
$$;

create or replace function public.ecolearn_queue_delivery()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ecolearn_notification_allowed(new) then return new; end if;
  insert into public.ecolearn_notification_deliveries(notification_id, channel, destination)
    select new.id, 'email', u.email from auth.users u join public.ecolearn_notification_preferences p on p.user_id = u.id
    where u.id = new.user_id and u.email_confirmed_at is not null and p.email_enabled;
  insert into public.ecolearn_notification_deliveries(notification_id, channel, destination)
    select new.id, 'push', d.token from public.ecolearn_push_devices d join public.ecolearn_notification_preferences p on p.user_id = d.user_id
    where d.user_id = new.user_id and p.push_enabled;
  return new;
end; $$;
create trigger ecolearn_notification_delivery after insert on public.notifications for each row execute function public.ecolearn_queue_delivery();

create or replace function public.ecolearn_notify_space()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_class uuid; v_community uuid; v_kind text; v_path text; v_user uuid;
begin
  if tg_table_name = 'ecolearn_assignments' then v_class := new.classroom_id; v_kind := 'assignment'; v_path := '/schools';
  elsif tg_table_name = 'ecolearn_announcements' then v_class := new.classroom_id; v_community := new.community_id; v_kind := 'announcement'; v_path := case when v_class is null then '/community' else '/schools' end;
  else v_community := new.community_id; v_kind := 'event'; v_path := '/community'; end if;
  for v_user in
    select user_id from public.ecolearn_classroom_members where classroom_id = v_class
    union select user_id from public.ecolearn_community_members where community_id = v_community
  loop
    if v_user <> new.created_by then
      insert into public.notifications(user_id, title, body, kind, target_path, dedupe_key, community_id, classroom_id, actor_id, source_id)
      values(v_user, case v_kind when 'assignment' then 'New classroom assignment' when 'event' then 'New community event' else 'New announcement' end,
        new.title, v_kind, v_path, v_kind || ':' || new.id, v_community, v_class, new.created_by, new.id) on conflict do nothing;
    end if;
  end loop;
  return new;
end; $$;
create trigger ecolearn_assignment_notification after insert on public.ecolearn_assignments for each row execute function public.ecolearn_notify_space();
create trigger ecolearn_announcement_notification after insert on public.ecolearn_announcements for each row execute function public.ecolearn_notify_space();
create trigger ecolearn_event_notification after insert on public.ecolearn_community_events for each row execute function public.ecolearn_notify_space();

create or replace function public.ecolearn_enqueue_reminders()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications(user_id, title, body, kind, target_path, dedupe_key)
  select p.user_id, 'Keep your learning streak going', 'Complete a lesson or scan an item today.', 'streak', '/learn',
    'streak:' || (now() at time zone coalesce(np.timezone, 'America/New_York'))::date
  from public.user_progress p left join public.ecolearn_notification_preferences np on np.user_id = p.user_id
  where p.streak_days > 0 and p.last_activity_date = current_date - 1
    and coalesce(np.streak_reminders, true)
    and extract(hour from now() at time zone coalesce(np.timezone, 'America/New_York')) = coalesce(np.reminder_hour, 18)
  on conflict do nothing;
  insert into public.notifications(user_id, title, body, kind, target_path, dedupe_key, classroom_id, actor_id, source_id)
  select m.user_id, 'An assignment is due soon', a.title, 'due', '/schools', 'due:' || a.id, a.classroom_id, a.created_by, a.id
  from public.ecolearn_assignments a join public.ecolearn_classroom_members m on m.classroom_id = a.classroom_id and m.classroom_role = 'student'
  where a.due_at > now() and a.due_at <= now() + interval '24 hours'
    and not exists(select 1 from public.lesson_progress lp where lp.lesson_id = a.lesson_id and lp.user_id = m.user_id and lp.status = 'completed')
  on conflict do nothing;
end; $$;

-- Concurrent workers lease distinct rows. A failed delivery is retryable with a bounded lifetime.
create or replace function public.ecolearn_claim_deliveries()
returns table(id uuid, lease_id uuid, channel text, destination text, notification_id uuid, title text, target_path text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query with pending as (
    select d.id from public.ecolearn_notification_deliveries d join public.notifications n on n.id = d.notification_id
    join public.ecolearn_notification_preferences p on p.user_id = n.user_id
    where d.delivered_at is null and d.available_at <= now() and d.attempts < 6
      and n.created_at > now() - interval '24 hours' and n.read_at is null
      and public.ecolearn_notification_allowed(n)
      and ((d.channel = 'email' and p.email_enabled and exists(select 1 from auth.users u where u.id = n.user_id and u.email = d.destination and u.email_confirmed_at is not null))
        or (d.channel = 'push' and p.push_enabled and exists(select 1 from public.ecolearn_push_devices pd where pd.token = d.destination and pd.user_id = n.user_id)))
    order by d.available_at for update of d skip locked limit 25
  ), claimed as (
    update public.ecolearn_notification_deliveries d set attempts = attempts + 1, lease_id = gen_random_uuid(), available_at = now() + interval '5 minutes'
    from pending where d.id = pending.id returning d.*
  ) select c.id, c.lease_id, c.channel, c.destination, c.notification_id, n.title, n.target_path from claimed c join public.notifications n on n.id = c.notification_id;
end; $$;

revoke all on function public.ecolearn_set_notification_preferences(boolean,boolean,boolean,boolean,boolean,text,integer),
  public.ecolearn_mark_notifications_read(uuid), public.ecolearn_register_push_device(text,boolean),
  public.ecolearn_notification_allowed(public.notifications), public.ecolearn_queue_delivery(), public.ecolearn_notify_space(),
  public.ecolearn_enqueue_reminders(), public.ecolearn_claim_deliveries() from public, anon, authenticated;
grant execute on function public.ecolearn_set_notification_preferences(boolean,boolean,boolean,boolean,boolean,text,integer),
  public.ecolearn_mark_notifications_read(uuid), public.ecolearn_register_push_device(text,boolean) to authenticated;
grant execute on function public.ecolearn_enqueue_reminders(), public.ecolearn_claim_deliveries() to service_role;

create or replace function public.ecolearn_notice_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.notifications n where n.id = p_id and n.user_id = auth.uid() and public.ecolearn_notification_allowed(n));
$$;
revoke all on function public.ecolearn_notice_visible(uuid) from public;
grant execute on function public.ecolearn_notice_visible(uuid) to authenticated;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated
  using(user_id = auth.uid() and public.ecolearn_notice_visible(id));

create or replace function public.ecolearn_remove_content_notifications()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.notifications where source_id = old.id;
  return old;
end; $$;
revoke all on function public.ecolearn_remove_content_notifications() from public;
create trigger ecolearn_assignment_remove_notices before delete on public.ecolearn_assignments for each row execute function public.ecolearn_remove_content_notifications();
create trigger ecolearn_announcement_remove_notices before delete on public.ecolearn_announcements for each row execute function public.ecolearn_remove_content_notifications();
create trigger ecolearn_event_remove_notices before delete on public.ecolearn_community_events for each row execute function public.ecolearn_remove_content_notifications();
