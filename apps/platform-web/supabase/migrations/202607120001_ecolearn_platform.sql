-- EcoLearn standalone schema for a new Supabase project.
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade, xp integer not null default 0, level integer not null default 1,
  total_scans integer not null default 0, total_lessons_completed integer not null default 0, streak_days integer not null default 0,
  last_activity_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null, is_recyclable boolean not null, confidence_score numeric, category text, instructions text, created_at timestamptz not null default now()
);
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(), title text not null, description text, icon text not null default 'trophy',
  requirement_type text not null check (requirement_type in ('scans','lessons','streak','level')), requirement_value integer not null, created_at timestamptz not null default now()
);
create table if not exists public.user_achievements (user_id uuid references auth.users(id) on delete cascade, achievement_id uuid references public.achievements(id) on delete cascade, earned_at timestamptz not null default now(), primary key(user_id, achievement_id));
create table if not exists public.municipalities (id uuid primary key default gen_random_uuid(), country text not null default 'US', state text, county text, city text not null, rules_url text, accepted_materials jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), unique(country, state, city));
create table if not exists public.user_settings (user_id uuid primary key references auth.users(id) on delete cascade, municipality_id uuid references public.municipalities(id), display_name text, avatar_url text, notifications_enabled boolean not null default true, onboarding_complete boolean not null default false, updated_at timestamptz not null default now());
create table if not exists public.lessons (id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, topic text not null, description text, duration_minutes integer not null default 5, xp_reward integer not null default 25, sort_order integer not null default 0, is_published boolean not null default false, content jsonb not null default '{}'::jsonb);
create table if not exists public.lesson_progress (user_id uuid references auth.users(id) on delete cascade, lesson_id uuid references public.lessons(id) on delete cascade, status text not null check (status in ('started','completed')) default 'started', score integer, completed_at timestamptz, primary key(user_id, lesson_id));
create table if not exists public.quiz_attempts (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, lesson_id uuid references public.lessons(id) on delete cascade, answers jsonb not null, score integer not null, created_at timestamptz not null default now());
create table if not exists public.quests (id uuid primary key default gen_random_uuid(), title text not null, description text not null, quest_type text not null check (quest_type in ('daily','weekly','seasonal','community')), target integer not null, xp_reward integer not null, starts_at timestamptz not null default now(), ends_at timestamptz, metadata jsonb not null default '{}'::jsonb);
create table if not exists public.quest_progress (user_id uuid references auth.users(id) on delete cascade, quest_id uuid references public.quests(id) on delete cascade, progress integer not null default 0, claimed_at timestamptz, primary key(user_id, quest_id));
create table if not exists public.groups (id uuid primary key default gen_random_uuid(), name text not null, description text, kind text not null check (kind in ('friends','school','organization','neighborhood')), owner_id uuid references auth.users(id) on delete set null, join_code text unique, created_at timestamptz not null default now());
create table if not exists public.group_members (group_id uuid references public.groups(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, role text not null default 'member' check (role in ('owner','teacher','organizer','member')), joined_at timestamptz not null default now(), primary key(group_id,user_id));
create table if not exists public.classrooms (id uuid primary key default gen_random_uuid(), group_id uuid unique references public.groups(id) on delete cascade, teacher_id uuid references auth.users(id) on delete set null, grade_label text, created_at timestamptz not null default now());
create table if not exists public.assignments (id uuid primary key default gen_random_uuid(), classroom_id uuid references public.classrooms(id) on delete cascade, lesson_id uuid references public.lessons(id), title text not null, due_at timestamptz, created_at timestamptz not null default now());
create table if not exists public.events (id uuid primary key default gen_random_uuid(), group_id uuid references public.groups(id) on delete cascade, title text not null, description text, starts_at timestamptz not null, location text, capacity integer, created_by uuid references auth.users(id) on delete set null);
create table if not exists public.event_rsvps (event_id uuid references public.events(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, status text not null default 'going', primary key(event_id,user_id));
create table if not exists public.scan_corrections (id uuid primary key default gen_random_uuid(), scan_id uuid references public.scan_history(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, corrected_item text, corrected_recyclable boolean, note text, created_at timestamptz not null default now());
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, title text not null, body text not null, kind text not null default 'general', read_at timestamptz, created_at timestamptz not null default now());

create or replace function public.handle_new_ecolearn_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.user_progress (user_id) values (new.id) on conflict do nothing; insert into public.user_settings (user_id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')) on conflict do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_ecolearn_user();

insert into public.lessons (id, slug, title, topic, description, duration_minutes, xp_reward, sort_order, is_published) values
('10000000-0000-4000-8000-000000000001','recycling-loop','The recycling loop','Recycling basics','What happens after the bin.',4,20,1,true),
('10000000-0000-4000-8000-000000000002','plastic-decoded','Plastic, decoded','Materials','Understand plastic labels.',6,30,2,true),
('10000000-0000-4000-8000-000000000003','wishcycling-myths','Wishcycling myths','Smart sorting','Avoid contamination.',5,25,3,true),
('10000000-0000-4000-8000-000000000004','food-second-life','Food’s second life','Composting','Turn food scraps into resources.',7,35,4,true)
on conflict (id) do update set title = excluded.title, topic = excluded.topic, description = excluded.description, is_published = excluded.is_published;
insert into public.achievements (title, description, icon, requirement_type, requirement_value)
select * from (values ('First scan','Identify your first item.','recycle','scans',1),('Sorting star','Identify 10 items.','star','scans',10),('Learning spark','Complete your first lesson.','book','lessons',1),('On a roll','Keep a 7-day streak.','flame','streak',7)) as seed(title,description,icon,requirement_type,requirement_value) where not exists (select 1 from public.achievements);

alter table public.user_progress enable row level security; alter table public.scan_history enable row level security; alter table public.achievements enable row level security; alter table public.user_achievements enable row level security; alter table public.municipalities enable row level security; alter table public.user_settings enable row level security; alter table public.lessons enable row level security; alter table public.lesson_progress enable row level security; alter table public.quiz_attempts enable row level security; alter table public.quests enable row level security; alter table public.quest_progress enable row level security; alter table public.groups enable row level security; alter table public.group_members enable row level security; alter table public.classrooms enable row level security; alter table public.assignments enable row level security; alter table public.events enable row level security; alter table public.event_rsvps enable row level security; alter table public.scan_corrections enable row level security; alter table public.notifications enable row level security;

create policy "own progress" on public.user_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own scans" on public.scan_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public achievements" on public.achievements for select using (true);
create policy "own achievements" on public.user_achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public municipalities" on public.municipalities for select using (true);
create policy "own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published lessons" on public.lessons for select using (is_published);
create policy "own lesson progress" on public.lesson_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own quiz attempts" on public.quiz_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "active quests" on public.quests for select using (starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "own quest progress" on public.quest_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "discover groups" on public.groups for select using (true);
create policy "create groups" on public.groups for insert with check (auth.uid() = owner_id);
create policy "manage owned groups" on public.groups for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own memberships" on public.group_members for select using (auth.uid() = user_id);
create policy "join groups" on public.group_members for insert with check (auth.uid() = user_id);
create policy "public classrooms" on public.classrooms for select using (true);
create policy "public assignments" on public.assignments for select using (true);
create policy "public events" on public.events for select using (true);
create policy "own rsvps" on public.event_rsvps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own corrections" on public.scan_corrections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
