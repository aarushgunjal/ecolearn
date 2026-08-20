-- Classroom, group, assignment, and event data models are intentionally
-- deferred until DSWA and participating schools approve the student privacy
-- design. The initial scaffold exposed these tables too broadly, including
-- group join codes through a public SELECT policy. Keep them inaccessible to
-- browser clients until a purpose-built teacher/student authorization model is
-- reviewed and introduced in a later migration.

drop policy if exists "discover groups" on public.groups;
drop policy if exists "create groups" on public.groups;
drop policy if exists "manage owned groups" on public.groups;
drop policy if exists "own memberships" on public.group_members;
drop policy if exists "join groups" on public.group_members;
drop policy if exists "public classrooms" on public.classrooms;
drop policy if exists "public assignments" on public.assignments;
drop policy if exists "public events" on public.events;
drop policy if exists "own rsvps" on public.event_rsvps;

revoke all on public.groups from anon, authenticated;
revoke all on public.group_members from anon, authenticated;
revoke all on public.classrooms from anon, authenticated;
revoke all on public.assignments from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.event_rsvps from anon, authenticated;
