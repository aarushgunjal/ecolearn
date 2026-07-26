grant execute on function public.is_app_admin() to authenticated;
create policy "admins view training images" on storage.objects for select using (bucket_id = 'training-feedback' and public.is_app_admin());
