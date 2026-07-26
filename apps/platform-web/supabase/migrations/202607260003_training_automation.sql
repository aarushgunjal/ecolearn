-- Reviewed, consented examples are grouped into immutable batches for automated training.
create table if not exists public.training_automation_settings (
  singleton boolean primary key default true check (singleton),
  batch_size integer not null default 20 check (batch_size between 1 and 5000),
  enabled boolean not null default true,
  auto_promote boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.training_automation_settings (singleton) values (true) on conflict do nothing;

create table if not exists public.training_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','rejected')),
  example_count integer not null check (example_count > 0),
  model_version text,
  metrics jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.scan_feedback add column if not exists training_batch_id uuid references public.training_batches(id) on delete set null;
create index if not exists scan_feedback_training_queue_idx on public.scan_feedback (reviewed_at, id) where training_consent and review_status = 'approved' and training_batch_id is null;

alter table public.training_automation_settings enable row level security;
alter table public.training_batches enable row level security;
create policy "admins manage training automation settings" on public.training_automation_settings for all using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admins view training batches" on public.training_batches for select using (public.is_app_admin());

create or replace function public.enqueue_training_batch()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size integer;
  v_enabled boolean;
  v_ids uuid[];
  v_batch_id uuid;
begin
  select batch_size, enabled into v_batch_size, v_enabled from public.training_automation_settings where singleton = true;
  if not coalesce(v_enabled, false) then return null; end if;
  select array_agg(id) into v_ids from (
    select id from public.scan_feedback
    where training_consent = true
      and review_status = 'approved'
      and image_path is not null
      and normalized_label in ('battery','biological','cardboard','clothes','glass','metal','paper','plastic','shoes','trash')
      and training_batch_id is null
    order by reviewed_at nulls last, created_at, id
    limit v_batch_size
    for update skip locked
  ) eligible;
  if coalesce(array_length(v_ids, 1), 0) < v_batch_size then return null; end if;
  insert into public.training_batches (example_count) values (array_length(v_ids, 1)) returning id into v_batch_id;
  update public.scan_feedback set training_batch_id = v_batch_id where id = any(v_ids);
  return v_batch_id;
end;
$$;

create or replace function public.on_training_eligible_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_training_batch();
  return new;
end;
$$;

drop trigger if exists queue_training_batch_on_review on public.scan_feedback;
create trigger queue_training_batch_on_review
after insert or update of review_status, normalized_label, training_consent, image_path on public.scan_feedback
for each row execute function public.on_training_eligible_feedback();

create or replace function public.on_training_automation_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_training_batch();
  return new;
end;
$$;

drop trigger if exists queue_training_batch_on_setting_change on public.training_automation_settings;
create trigger queue_training_batch_on_setting_change
after update of batch_size, enabled on public.training_automation_settings
for each row execute function public.on_training_automation_setting_change();

create or replace function public.claim_next_training_batch()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.training_batches where status = 'queued' order by created_at for update skip locked limit 1;
  if v_id is null then return null; end if;
  update public.training_batches set status = 'running', started_at = now(), error_message = null where id = v_id;
  return v_id;
end;
$$;

create or replace function public.finish_training_batch(p_batch_id uuid, p_status text, p_model_version text default null, p_metrics jsonb default null, p_error_message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded','failed','rejected') then raise exception 'Invalid terminal training status'; end if;
  update public.training_batches set status = p_status, model_version = p_model_version, metrics = p_metrics, error_message = left(p_error_message, 1000), completed_at = now() where id = p_batch_id and status = 'running';
end;
$$;

revoke all on function public.enqueue_training_batch() from public;
revoke all on function public.claim_next_training_batch() from public;
revoke all on function public.finish_training_batch(uuid, text, text, jsonb, text) from public;
