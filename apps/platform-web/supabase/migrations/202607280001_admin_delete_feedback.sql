-- Allow designated EcoLearn admins to remove a feedback record and any photo
-- that the contributor explicitly opted in to share for review/training.
-- The existing "users delete own scan feedback" policy remains in place.

drop policy if exists "admins delete scan feedback" on public.scan_feedback;
create policy "admins delete scan feedback"
on public.scan_feedback
for delete
using (public.is_app_admin());

drop policy if exists "admins delete training images" on storage.objects;
create policy "admins delete training images"
on storage.objects
for delete
using (
  bucket_id = 'training-feedback'
  and public.is_app_admin()
);
