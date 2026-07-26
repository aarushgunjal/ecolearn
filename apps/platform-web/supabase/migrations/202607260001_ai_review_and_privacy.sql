-- AI review is opt-in. Training examples remain auditable and can be deleted.
alter table public.scan_feedback
  add column if not exists ai_review_consent boolean not null default false,
  add column if not exists normalized_label text,
  add column if not exists reviewer_kind text check (reviewer_kind in ('llm','human')),
  add column if not exists review_confidence numeric check (review_confidence between 0 and 1),
  add column if not exists review_rationale text,
  add column if not exists review_model text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists retention_expires_at timestamptz;

create table if not exists public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
insert into public.app_admins (user_id) select id from auth.users where lower(email) = 'aarushgunjal1@gmail.com' on conflict do nothing;
create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()); $$;
create policy "admins review scan feedback" on public.scan_feedback for select using (public.is_app_admin());
create policy "admins update scan feedback" on public.scan_feedback for update using (public.is_app_admin()) with check (public.is_app_admin());
create policy "users delete own scan feedback" on public.scan_feedback for delete using (auth.uid() = user_id);
