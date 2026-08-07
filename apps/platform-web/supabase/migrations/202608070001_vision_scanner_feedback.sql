-- Keep feedback from the one-call vision scanner out of the retired ten-class
-- classifier training queue. Feedback remains available for human evaluation.

drop index if exists public.scan_feedback_training_queue_idx;
create index scan_feedback_training_queue_idx
  on public.scan_feedback (reviewed_at, id)
  where training_consent
    and review_status = 'approved'
    and training_batch_id is null
    and model_version = 'hf-waste-classifier-v1';

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
  select batch_size, enabled
  into v_batch_size, v_enabled
  from public.training_automation_settings
  where singleton = true;
  if not coalesce(v_enabled, false) then return null; end if;

  select array_agg(id) into v_ids from (
    select id
    from public.scan_feedback
    where training_consent = true
      and review_status = 'approved'
      and image_path is not null
      and model_version = 'hf-waste-classifier-v1'
      and normalized_label in (
        'battery','biological','cardboard','clothes','glass',
        'metal','paper','plastic','shoes','trash'
      )
      and active_learning_reason in (
        'user_correction','low_confidence',
        'model_llm_disagreement','representative_sample'
      )
      and training_batch_id is null
    order by
      case active_learning_reason
        when 'user_correction' then 1
        when 'model_llm_disagreement' then 2
        when 'low_confidence' then 3
        else 4
      end,
      reviewed_at nulls last,
      created_at,
      id
    limit v_batch_size
    for update skip locked
  ) eligible;

  if coalesce(array_length(v_ids, 1), 0) < v_batch_size then return null; end if;
  insert into public.training_batches (example_count)
  values (array_length(v_ids, 1))
  returning id into v_batch_id;
  update public.scan_feedback
  set training_batch_id = v_batch_id
  where id = any(v_ids);
  return v_batch_id;
end;
$$;

revoke all on function public.enqueue_training_batch() from public, anon, authenticated;
