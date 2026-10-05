-- Preview uses the caller's management permission. It never impersonates a
-- learner, reveals a roster, or writes completion/XP state.
create or replace function public.ecolearn_preview_classroom(p_classroom_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_class public.ecolearn_classrooms;
begin
  if not public.ecolearn_can_manage_classroom(p_classroom_id) then raise exception 'Teacher access required'; end if;
  select * into v_class from public.ecolearn_classrooms where id=p_classroom_id;
  return jsonb_build_object(
    'name',v_class.name,'grade',v_class.grade_label,
    'school',(select name from public.ecolearn_communities where id=v_class.community_id),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'lesson_id',a.lesson_id,'lesson_title',l.title,'due_at',a.due_at) order by a.due_at nulls last,a.created_at desc)
      from public.ecolearn_assignments a join public.lessons l on l.id=a.lesson_id where a.classroom_id=p_classroom_id),'[]'::jsonb),
    'announcements',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'body',a.body) order by a.created_at desc)
      from public.ecolearn_announcements a where a.removed_at is null and (a.classroom_id=p_classroom_id or a.community_id=v_class.community_id)),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'starts_at',e.starts_at,'location',e.location) order by e.starts_at)
      from public.ecolearn_community_events e where e.community_id=v_class.community_id and e.removed_at is null and e.starts_at>=now()-interval '1 day'),'[]'::jsonb)
  );
end; $$;
revoke all on function public.ecolearn_preview_classroom(uuid) from public,anon;
grant execute on function public.ecolearn_preview_classroom(uuid) to authenticated;
