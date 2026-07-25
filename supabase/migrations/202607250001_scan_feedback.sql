create table public.scan_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  scan_id uuid references public.scan_history(id) on delete set null, predicted_label text not null, predicted_recyclable boolean not null,
  verdict text not null check (verdict in ('correct','incorrect')), issue text check (issue in ('wrong_item','wrong_disposal','unclear_guidance')),
  corrected_disposal text check (corrected_disposal in ('recycle','trash','special_dropoff','not_sure')), training_consent boolean not null default false,
  image_path text, model_version text not null default 'hf-waste-classifier-v1', review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), check ((training_consent and image_path is not null) or (not training_consent and image_path is null))
);
alter table public.scan_feedback enable row level security;
create policy "Users create own scan feedback" on public.scan_feedback for insert with check (auth.uid() = user_id);
create policy "Users view own scan feedback" on public.scan_feedback for select using (auth.uid() = user_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('training-feedback', 'training-feedback', false, 8388608, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "Users upload opted-in training images" on storage.objects for insert to authenticated with check (bucket_id = 'training-feedback' and (storage.foldername(name))[1] = auth.uid()::text);
