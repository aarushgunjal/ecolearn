# EcoLearn community and classroom deployment

The web, iOS, and Android clients now use the same Supabase-backed community model. Deploy the database migration before testing these screens:

`apps/platform-web/supabase/migrations/202608300001_roles_communities_classrooms.sql`

## Production deployment

1. Open the EcoLearn project in Supabase, then open **SQL Editor**.
2. Paste the complete migration file into a new query.
3. Confirm the selected project is the production EcoLearn project.
4. Run the query once. The migration is intentionally idempotent for table creation, policies, functions, triggers, and grants.
5. Sign out and back in on EcoLearn so the profile and role data refresh.

The Supabase Edge Function GitHub Action does not apply database migrations. Do not expect rerunning that function workflow to deploy this SQL.

## Acceptance check

- A new account starts as a student and cannot self-promote to teacher or admin.
- An administrator can create a school, create a classroom, and generate separate student and teacher invitation codes.
- A teacher invitation promotes its holder to teacher and joins that classroom.
- A student can join multiple classrooms and communities with different codes.
- Only classroom teachers/admins can view student aliases and individual progress.
- School members see class aggregate standings, never individual student rankings.
- Community managers can publish announcements and events; members can RSVP.
- Teachers can assign published EcoLearn lessons and see completion totals.
- Join codes are visible only to the relevant manager/teacher and are never publicly discoverable.

## Youth privacy release gate

The technical model minimizes student data by using aliases and aggregate school standings, but it does not replace legal and school-policy review. Before an under-13 rollout, document who creates student access, what consent or school authorization applies, retention/deletion rules, and who at DSWA or each school can administer classrooms.
