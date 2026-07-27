-- One-time account preferences and auditable active-learning metadata.
alter table public.user_settings
  add column if not exists training_consent_enabled boolean not null default false,
  add column if not exists ai_second_opinion_enabled boolean not null default false;

alter table public.scan_feedback
  add column if not exists predicted_confidence numeric check (predicted_confidence between 0 and 1),
  add column if not exists second_opinion_label text,
  add column if not exists second_opinion_confidence numeric check (second_opinion_confidence between 0 and 1),
  add column if not exists second_opinion_model text,
  add column if not exists second_opinion_at timestamptz,
  add column if not exists active_learning_reason text check (active_learning_reason in ('user_correction','low_confidence','model_llm_disagreement','representative_sample'));

create index if not exists scan_feedback_active_learning_idx on public.scan_feedback (active_learning_reason, reviewed_at)
  where training_consent and review_status = 'approved';

-- Only hard examples or a tiny representative sample can be sent to retraining.
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
      and active_learning_reason in ('user_correction','low_confidence','model_llm_disagreement','representative_sample')
      and training_batch_id is null
    order by case active_learning_reason when 'user_correction' then 1 when 'model_llm_disagreement' then 2 when 'low_confidence' then 3 else 4 end,
      reviewed_at nulls last, created_at, id
    limit v_batch_size
    for update skip locked
  ) eligible;
  if coalesce(array_length(v_ids, 1), 0) < v_batch_size then return null; end if;
  insert into public.training_batches (example_count) values (array_length(v_ids, 1)) returning id into v_batch_id;
  update public.scan_feedback set training_batch_id = v_batch_id where id = any(v_ids);
  return v_batch_id;
end;
$$;
