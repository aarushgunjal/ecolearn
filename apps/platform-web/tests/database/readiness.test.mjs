import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('production memberships, RLS, learning, deletion, and notification delivery', async (t) => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    grant usage on schema storage to authenticated, anon, service_role;
    grant all on storage.objects to authenticated, service_role;
  `);
  // Run every application migration in order against PostgreSQL. Supabase-owned
  // auth/storage schemas are fixtures; pgcrypto is omitted (core UUIDs are available).
  for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url))).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = (await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', '');
    try { await db.exec(sql); } catch (error) { throw new Error(`Migration ${name}: ${error.message}`); }
  }
  const teacher = '00000000-0000-4000-8000-000000000001';
  const student = '00000000-0000-4000-8000-000000000002';
  const stranger = '00000000-0000-4000-8000-000000000003';
  const coteacher = '00000000-0000-4000-8000-000000000004';
  const lesson = '10000000-0000-4000-8000-000000000001';
  for (const [id, role] of [[teacher, 'teacher'], [student, 'student'], [stranger, 'admin'], [coteacher, 'teacher']]) {
    await db.query(`insert into auth.users values($1,$2,$3,now())`, [id, JSON.stringify({ account_role: role }), `${id}@example.test`]);
  }
  const as = async (id, role = 'authenticated') => { await db.exec(`reset role; set role ${role}`); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id ?? '']); };
  const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0].result;
  let school, room, event, assignment, teacherCode;
  await t.test('guests cannot execute privileged functions; public lessons stay readable', async () => {
    await as(null, 'anon');
    const functions = await db.query(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE')`);
    assert.equal(functions.rows.length, 0);
    await assert.rejects(rpc('ecolearn_get_hub'), /permission denied/);
    await assert.rejects(rpc('claim_next_training_batch'), /permission denied/);
    await db.exec('reset role; grant select on public.lessons to anon; set role anon');
    assert.ok((await db.query('select id from public.lessons where is_published')).rows.length > 0);
    await as(student);
    await assert.rejects(rpc('award_eligible_achievements', [teacher]), /permission denied/);
    await assert.rejects(rpc('claim_next_training_batch'), /permission denied/);
    await assert.rejects(rpc('ecolearn_claim_deliveries'), /permission denied/);
  });
  await t.test('teacher signup works; metadata cannot create administrators', async () => {
    await as(teacher); assert.equal(await rpc('ecolearn_effective_role'), 'teacher');
    await as(stranger); assert.equal(await rpc('ecolearn_effective_role'), 'student');
    await assert.rejects(rpc('ecolearn_create_community', ['Denied', 'school', '']), /Teacher access/);
    await as(teacher); school = await rpc('ecolearn_create_community', ['Test school', 'school', 'Integration test']);
    room = await rpc('ecolearn_create_classroom', [school.id, 'Test class', 'Grade 5']);
  });
  await t.test('creators cannot rejoin or downgrade their teaching role', async () => {
    await assert.rejects(rpc('ecolearn_join_space', [school.join_code]), /already belong/);
    await assert.rejects(rpc('ecolearn_join_space', [room.join_code]), /already belong/);
    assert.equal((await rpc('ecolearn_get_hub')).classrooms[0].role, 'teacher');
  });
  await t.test('students join multiple spaces; outsiders cannot read codes, rosters, or assignments', async () => {
    await as(student); await rpc('ecolearn_join_space', [room.join_code]);
    const hub = await rpc('ecolearn_get_hub'); assert.equal(hub.communities.length, 1); assert.equal(hub.classrooms[0].join_code, null);
    assert.equal((await db.query('select * from ecolearn_join_codes')).rows.length, 0);
    await assert.rejects(rpc('ecolearn_get_classroom_dashboard', [room.id]), /Teacher access/);
    await assert.rejects(rpc('ecolearn_create_assignment', [room.id, lesson, 'Forbidden', null]), /Teacher access/);
    await as(stranger); assert.equal((await rpc('ecolearn_get_hub')).communities.length, 0);
    await assert.rejects(rpc('ecolearn_get_school_standings', [school.id]), /membership/);
  });
  await t.test('profile choice never grants access to someone else’s classroom', async () => {
    await as(stranger); await rpc('ecolearn_set_profile', ['New teacher', 'teacher']);
    await assert.rejects(rpc('ecolearn_get_classroom_dashboard', [room.id]), /Teacher access/);
    await assert.rejects(rpc('ecolearn_delete_space', ['classroom', room.id]), /Only the classroom/);
    await assert.rejects(rpc('ecolearn_set_profile', ['Bad', 'admin']), /student or teacher/);
  });
  await t.test('teacher invitation can promote a student, never downgrade a teacher', async () => {
    await as(teacher); teacherCode = await rpc('ecolearn_rotate_join_code', ['classroom', room.id, 'teacher']);
    await as(coteacher); await rpc('ecolearn_join_space', [teacherCode]);
    await assert.rejects(rpc('ecolearn_join_space', [room.join_code]), /already belong/);
    await assert.rejects(rpc('ecolearn_delete_space', ['classroom', room.id]), /Only the classroom/);
    await assert.rejects(rpc('ecolearn_leave_space', ['community', school.id]), /still teach/);
    await assert.rejects(rpc('ecolearn_set_profile', ['Teacher', 'student']), /spaces you manage/);
  });
  await t.test('rotation revokes old codes', async () => {
    await as(teacher); const code = await rpc('ecolearn_rotate_join_code', ['classroom', room.id, 'student']);
    await as(stranger); await assert.rejects(rpc('ecolearn_join_space', [room.join_code]), /invalid or expired/);
    await rpc('ecolearn_join_space', [code]);
    await rpc('ecolearn_leave_space', ['classroom', room.id]);
  });
  await t.test('duplicate undated assignments, past deadlines, and unpublished lessons are rejected', async () => {
    await as(teacher);
    await assert.rejects(rpc('ecolearn_create_assignment', [room.id, lesson, 'Past deadline', '2020-01-01']), /future due date/);
    await assert.rejects(rpc('ecolearn_create_assignment', [room.id, teacher, 'Missing lesson', null]), /published lesson/);
    const id = await rpc('ecolearn_create_assignment', [room.id, lesson, 'No deadline', null]);
    await assert.rejects(rpc('ecolearn_create_assignment', [room.id, lesson, 'Duplicate', null]), /already assigned/);
    await rpc('ecolearn_delete_content', ['assignment', id]);
  });
  await t.test('administrators discover and delete communities without joining; teachers cannot delete unrelated spaces', async () => {
    const admin = '00000000-0000-4000-8000-000000000099';
    await as(teacher);
    const managed = await rpc('ecolearn_create_community', ['Admin management check', 'organization', '']);
    await as(coteacher);
    assert.equal((await rpc('ecolearn_get_hub')).communities.some(c => c.id === managed.id), false);
    await assert.rejects(rpc('ecolearn_delete_space', ['community', managed.id]), /Only the community owner/);
    await db.exec('reset role');
    await db.query('insert into auth.users(id) values($1)', [admin]);
    await db.query('insert into app_admins(user_id) values($1)', [admin]);
    await as(admin);
    const visible = (await rpc('ecolearn_get_hub')).communities.find(c => c.id === managed.id);
    assert.equal(visible.role, 'admin');
    assert.equal(visible.can_delete, true);
    await rpc('ecolearn_delete_space', ['community', managed.id]);
    assert.equal((await rpc('ecolearn_get_hub')).communities.some(c => c.id === managed.id), false);
    await as(teacher);
  });
  await t.test('direct writes cannot escalate roles or rewrite progress and invitations', async () => {
    await as(student);
    await assert.rejects(db.query('insert into app_admins(user_id) values($1)', [student]), /permission denied|row-level security/);
    await assert.rejects(db.query("insert into ecolearn_community_members(community_id,user_id,member_role) values($1,$2,'owner')", [school.id, student]), /permission denied|row-level security/);
    await assert.rejects(db.query("insert into ecolearn_join_codes(code,community_id,access_role,created_by) values('COM-FAKE123',$1,'member',$2)", [school.id, student]), /permission denied|row-level security/);
    const progress = await db.query('update user_progress set xp=999999 where user_id=$1 returning user_id', [student]);
    assert.equal(progress.rows.length, 0);
    await as(teacher);
  });
  await t.test('assignments produce private notifications; email and push require opt-in', async () => {
    await as(student); await rpc('ecolearn_set_notification_preferences', [true, true, true, true, true, 'America/New_York', 18]);
    await rpc('ecolearn_register_push_device', ['ExpoPushToken[test_device]']);
    await as(teacher); assignment = await rpc('ecolearn_create_assignment', [room.id, lesson, 'Read the recycling lesson', new Date(Date.now() + 3600000).toISOString()]);
    const dashboard = await rpc('ecolearn_get_classroom_dashboard', [room.id]); assert.equal(dashboard.assignments[0].student_count, 1);
    await as(student); const inbox = (await db.query('select * from notifications')).rows;
    assert.equal(inbox.length, 1); assert.equal(inbox[0].kind, 'assignment');
    await assert.rejects(db.query("insert into notifications(user_id,title,body) values($1,'Fake','Fake')", [student]), /permission denied/);
    await assert.rejects(rpc('ecolearn_claim_deliveries'), /permission denied/);
    await assert.rejects(db.query('select * from ecolearn_notification_deliveries'), /permission denied/);
    await as(null, 'service_role'); const jobs = (await db.query('select * from ecolearn_claim_deliveries()')).rows;
    assert.equal(jobs.length, 2); assert.deepEqual(jobs.map((j) => j.channel).sort(), ['email', 'push']);
    assert.equal((await db.query('select * from ecolearn_claim_deliveries()')).rows.length, 0, 'leases prevent overlapping sends');
  });
  await t.test('notification read state is per account and mark-all is scoped', async () => {
    await as(student); await rpc('ecolearn_mark_notifications_read', [null]);
    assert.ok((await db.query('select read_at from notifications')).rows.every((n) => n.read_at));
    await as(coteacher); assert.ok((await db.query('select read_at from notifications')).rows.every((n) => n.read_at === null));
  });
  await t.test('lesson answers are checked server-side and duplicate completion cannot mint XP', async () => {
    await as(student);
    await assert.rejects(rpc('complete_ecolearn_lesson', [lesson, 0]), /answer/i);
    await rpc('complete_ecolearn_lesson', [lesson, 1]);
    const first = (await db.query('select xp from user_progress')).rows[0].xp;
    await rpc('complete_ecolearn_lesson', [lesson, 1]);
    assert.equal((await db.query('select xp from user_progress')).rows[0].xp, first);
    await as(teacher); assert.equal((await rpc('ecolearn_get_classroom_dashboard', [room.id])).assignments[0].completed_count, 1);
  });
  await t.test('event RSVP is idempotent, can be cancelled, and requires membership', async () => {
    await as(teacher); event = await rpc('ecolearn_create_event', [school.id, 'Cleanup', 'Bring gloves', new Date(Date.now() + 86400000).toISOString(), 'School']);
    await assert.rejects(rpc('ecolearn_create_event', [school.id, 'Past event', '', '2020-01-01', '']), /future/);
    await as(student); await rpc('ecolearn_rsvp_event', [event, 'going']); await rpc('ecolearn_rsvp_event', [event, 'going']);
    assert.equal((await rpc('ecolearn_get_hub')).events[0].rsvp_count, 1);
    await rpc('ecolearn_rsvp_event', [event, 'cancelled']); assert.equal((await rpc('ecolearn_get_hub')).events[0].rsvp_count, 0);
  });
  await t.test('reminder generation is idempotent and skips completed assignments', async () => {
    await as(null, 'service_role'); await rpc('ecolearn_enqueue_reminders'); await rpc('ecolearn_enqueue_reminders');
    assert.equal((await db.query("select * from notifications where kind = 'due'")).rows.length, 0);
  });
  await t.test('moderation, blocking, and removed content apply to both hub and notifications', async () => {
    await as(teacher);
    await assert.rejects(rpc('ecolearn_create_announcement', ['community', school.id, 'Contact', 'Email person@example.test']), /cannot include/);
    const announcement = await rpc('ecolearn_create_announcement', ['community', school.id, 'Class update', 'Bring a reusable bottle']);
    await as(student); await rpc('ecolearn_block_user', [teacher]);
    assert.equal((await rpc('ecolearn_get_hub')).announcements.length, 0);
    assert.equal((await db.query("select * from notifications where kind in ('announcement','event')")).rows.length, 0);
    await rpc('ecolearn_unblock_user', [teacher]);
    assert.equal((await rpc('ecolearn_get_hub')).announcements.length, 1);
    const report = await rpc('ecolearn_report_content', ['announcement', announcement, 'other', 'Test report']);
    await as(teacher); await rpc('ecolearn_resolve_report', [report, 'remove', 'Test removal']);
    await as(student); assert.equal((await rpc('ecolearn_get_hub')).announcements.length, 0);
    assert.equal((await db.query("select * from notifications where kind = 'announcement'")).rows.length, 0);
    await assert.rejects(rpc('ecolearn_delete_content', ['event', event]), /Manager access/);
  });
  await t.test('due reminders are generated exactly once and delivery respects opt-out', async () => {
    await as(teacher); await rpc('ecolearn_create_assignment', [room.id, '10000000-0000-4000-8000-000000000002', 'Another assignment', new Date(Date.now() + 3600000).toISOString()]);
    await as(student); await rpc('ecolearn_set_notification_preferences', [false, false, true, true, true, 'America/New_York', 18]);
    await assert.rejects(rpc('ecolearn_set_notification_preferences', [false, false, true, true, true, 'Not/AZone', 18]), /timezone/);
    await as(null, 'service_role'); await rpc('ecolearn_enqueue_reminders'); await rpc('ecolearn_enqueue_reminders');
    assert.equal((await db.query("select * from notifications where kind = 'due'")).rows.length, 1);
    assert.equal((await db.query('select * from ecolearn_claim_deliveries()')).rows.length, 0);
  });
  await t.test('streak reminders use local reminder hour and deduplicate', async () => {
    await db.exec('reset role');
    await db.query('update user_progress set last_activity_date = current_date - 1, streak_days = 3 where user_id = $1', [student]);
    const hour = (await db.query("select extract(hour from now() at time zone 'UTC')::integer as hour")).rows[0].hour;
    await as(student); await rpc('ecolearn_set_notification_preferences', [false, false, true, true, true, 'UTC', hour]);
    await as(null, 'service_role'); await rpc('ecolearn_enqueue_reminders'); await rpc('ecolearn_enqueue_reminders');
    assert.equal((await db.query("select * from notifications where kind = 'streak'")).rows.length, 1);
  });
  await t.test('retired rewards cannot mint XP and classroom member removal is protected', async () => {
    await as(student); await assert.rejects(rpc('claim_ecolearn_reward', ['weekend_reusable_cup']), /unavailable/);
    await assert.rejects(rpc('claim_ecolearn_reward', ['daily_three_scans']), /three verified scans/);
    await assert.rejects(rpc('ecolearn_remove_classroom_member', [room.id, teacher]), /Teacher access/);
    await as(teacher); await assert.rejects(rpc('ecolearn_remove_classroom_member', [room.id, teacher]), /creator cannot/);
    await rpc('ecolearn_remove_classroom_member', [room.id, coteacher]);
    await as(coteacher); await assert.rejects(rpc('ecolearn_get_classroom_dashboard', [room.id]), /Teacher access/);
  });
  await t.test('departed co-teacher authored content does not prevent account deletion', async () => {
    await as(teacher); const code = await rpc('ecolearn_rotate_join_code', ['classroom', room.id, 'teacher']);
    await as(coteacher); await rpc('ecolearn_join_space', [code]);
    const id = await rpc('ecolearn_create_announcement', ['classroom', room.id, 'Reminder', 'Bring a notebook']);
    await rpc('ecolearn_leave_space', ['classroom', room.id]);
    await db.exec('reset role'); await db.query('delete from auth.users where id = $1', [coteacher]);
    assert.equal((await db.query('select created_by from ecolearn_announcements where id = $1', [id])).rows[0].created_by, null);
  });
  await t.test('image feedback tables and storage uploads are retired', async () => {
    await as(student);
    await assert.rejects(db.query('select * from scan_feedback'), /permission denied/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('training-feedback',$1)", [`${student}/photo.jpg`]), /row-level security/);
    await db.exec('reset role');
    assert.equal((await db.query('select enabled from training_automation_settings')).rows[0].enabled, false);
  });
  await t.test('deleting spaces is authorized and cascades without erasing earned progress', async () => {
    await as(student); await assert.rejects(rpc('ecolearn_delete_space', ['community', school.id]), /Only the community owner/);
    await as(teacher); await rpc('ecolearn_delete_space', ['classroom', room.id]);
    assert.equal((await rpc('ecolearn_get_hub')).classrooms.length, 0);
    await rpc('ecolearn_delete_space', ['community', school.id]);
    await as(student); assert.equal((await rpc('ecolearn_get_hub')).communities.length, 0);
    assert.ok((await db.query('select xp from user_progress')).rows[0].xp > 0);
    assert.equal((await db.query("select * from notifications where kind <> 'streak'")).rows.length, 0);
  });
  await db.close();
});
