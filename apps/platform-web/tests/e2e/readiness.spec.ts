import { expect, test, type Page } from '@playwright/test';
import { EcoLearnPage } from './pages/EcoLearnPage';

test.beforeEach(async ({ page }) => {
  await page.route('https://ecolearn-test.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
});

const userId = '00000000-0000-4000-8000-000000000001';
const schoolId = '00000000-0000-4000-8000-000000000010';
const roomId = '00000000-0000-4000-8000-000000000011';
const lessonId = '10000000-0000-4000-8000-000000000006';
const noticeId = '00000000-0000-4000-8000-000000000012';
test('signup stays scrollable and usable on short narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  const app = new EcoLearnPage(page); await app.goto(); await app.openAuthDialog();
  const dialog = page.getByRole('dialog', { name: 'Start your eco journey' });
  const bounds = await dialog.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
  const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => ({ tag: e.tagName, className: e.className, right: e.getBoundingClientRect().right })) }));
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByPlaceholder('Password', { exact: true })).toBeVisible();
});
function hub(role: 'student' | 'teacher' | 'admin') {
  return { profile: { role, alias: 'Test learner' }, communities: [{ id: schoolId, name: 'Test school', kind: 'school', role: role === 'teacher' ? 'owner' : 'member', member_count: 2, classroom_count: 1, total_xp: 20, total_scans: 0, join_code: role === 'teacher' ? 'SCH-TEST123' : null }], classrooms: [{ id: roomId, community_id: schoolId, school_name: 'Test school', name: 'Test classroom', grade_label: 'Grade 5', role, can_delete: role === 'teacher', student_count: 1, total_xp: 20, lesson_completions: 1, join_code: role === 'teacher' ? 'CLS-TEST123' : null }], assignments: [{ id: 'assignment1', classroom_id: roomId, classroom_name: 'Test classroom', lesson_id: lessonId, lesson_title: 'Smarter compost habits', title: 'Compost assignment', completed: false }], events: [], announcements: [], blocked_users: [] };
}
async function signedIn(page: Page, role: 'student' | 'teacher' | 'admin' = 'teacher', verified = true) {
  let state = hub(role);
  let saved = state;
  let deleted: Array<{ id: string; scope: string; name: string; delete_after: string }> = [];
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  await page.route('**/rest/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const name = path.split('/').pop()!;
    let result: unknown = [];
    if (path.includes('/rpc/')) {
      const body = route.request().postDataJSON() ?? {};
      calls.push({ name, body });
      if (name === 'ecolearn_get_hub') result = state;
      else if (name === 'ecolearn_get_classroom_dashboard') result = { students: [], assignments: [] };
      else if (name === 'ecolearn_delete_space') { saved = state; deleted = [{ id: String(body.p_scope_id), scope: String(body.p_scope), name: body.p_scope === 'community' ? 'Test school' : 'Test classroom', delete_after: new Date(Date.now() + 7 * 86400000).toISOString() }]; state = { ...state, classrooms: [], ...(body.p_scope === 'community' ? { communities: [] } : {}) }; result = null; }
      else if (name === 'ecolearn_get_deleted_spaces') result = deleted;
      else if (name === 'ecolearn_restore_space') { state = saved; deleted = []; result = null; }
      else if (name === 'ecolearn_admin_access') result = { is_admin: role === 'admin', verified: role === 'admin' && verified };
      else if (name === 'ecolearn_mark_notifications_read' || name === 'ecolearn_set_notification_preferences') result = null;
      else if (name === 'is_app_admin') result = role === 'admin' && verified;
    } else if (name === 'notifications') result = [{ id: noticeId, title: 'New assignment', body: 'Review composting', created_at: '2026-09-14T12:00:00Z', read_at: null, target_path: '/schools' }];
    else if (name === 'ecolearn_notification_preferences' || name === 'user_settings' || name === 'user_progress') result = null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const user = { id: userId, email: 'fixture@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, factors: [] as Array<Record<string, unknown>>, created_at: '2026-01-01T00:00:00Z' };
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'local-test-session', refresh_token: 'local-test-refresh', expires_in: 3600, token_type: 'bearer', user }) }));
  await page.route('**/auth/v1/user', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/auth/v1/factors**', async route => {
    const url = new URL(route.request().url());
    const body = route.request().postDataJSON() ?? {};
    calls.push({ name: route.request().method() + ' ' + url.pathname, body });
    let result: unknown = { id: 'factor-test', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"></svg>', secret: 'LOCALTESTSECRET', uri: 'otpauth://totp/EcoLearn?secret=LOCALTESTSECRET' } };
    if (url.pathname.endsWith('/challenge')) result = { id: 'challenge-test', expires_at: Math.floor(Date.now() / 1000) + 300 };
    if (url.pathname.endsWith('/verify')) {
      if (body.code !== '123456') { await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid authenticator code' }) }); return; }
      verified = true; user.factors = [{ id: 'factor-test', status: 'verified', factor_type: 'totp', friendly_name: 'Test authenticator' }];
      result = { access_token: 'local-mfa-session', refresh_token: 'local-mfa-refresh', expires_in: 3600, token_type: 'bearer', user };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const app = new EcoLearnPage(page); await app.goto(); await app.openAuthDialog();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByPlaceholder('Email address').fill('fixture@example.test');
  await page.getByPlaceholder('Password', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close sign-in dialog' })).toHaveCount(0);
  return { app, calls };
}

for (const role of ['student', 'teacher'] as const) {
  test(`${role} signup sends the selected account type`, async ({ page }) => {
    let request: Record<string, unknown> | undefined;
    await page.route('**/auth/v1/signup**', async (route) => { request = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: userId, identities: [], user_metadata: { account_role: role } }) }); });
    const app = new EcoLearnPage(page); await app.goto(); await app.openAuthDialog();
    await page.getByLabel('Account type', { exact: true }).selectOption(role);
    await page.getByPlaceholder('Email address').fill('signup@example.test');
    await page.getByPlaceholder('Password', { exact: true }).fill('local-test-password');
    await page.getByRole('button', { name: 'Create free account', exact: true }).click();
    await expect.poll(() => request).toMatchObject({ data: { account_role: role } });
  });
}

test('teacher cannot rejoin own school or classroom from UI', async ({ page }) => {
  const { app, calls } = await signedIn(page); await app.openMoreSection('Schools');
  await page.getByLabel('Join code').fill('CLS-TEST123');
  await expect(page.getByRole('button', { name: 'Join space', exact: true })).toBeDisabled();
  await page.getByLabel('Join code').fill('SCH-TEST123');
  await expect(page.getByRole('button', { name: 'Join space', exact: true })).toBeDisabled();
  expect(calls.some((call) => call.name === 'ecolearn_join_space')).toBe(false);
});

test('community contains classrooms on desktop and mobile without a separate menu', async ({ page }) => {
  const { app } = await signedIn(page);
  await app.openPrimarySection('Community');
  await expect(page.getByRole('region', { name: 'Your classrooms' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Classrooms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete classroom', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More EcoLearn tools' })).toHaveCount(0);
  await page.getByText('Updates and events', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Announcements', exact: true })).toBeVisible();
});

test('admin management opens communities with delete controls instead of personal analytics', async ({ page }) => {
  const { app } = await signedIn(page, 'admin');
  await app.openMoreSection('Profile');
  await page.getByRole('button', { name: 'Manage communities', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your communities and classrooms' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete community', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personal analytics' })).toHaveCount(0);
});

test('community deletion names the target and requires an exact confirmation', async ({ page }) => {
  const { app, calls } = await signedIn(page);
  await app.openPrimarySection('Community');
  await page.getByRole('button', { name: 'Delete community', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete Test school?' });
  await dialog.getByRole('textbox').fill('wrong school');
  await expect(dialog.getByRole('button', { name: 'Move to recently deleted' })).toBeDisabled();
  await dialog.getByRole('textbox').fill('Test school');
  await dialog.getByRole('button', { name: 'Move to recently deleted' }).click();
  await expect(page.getByRole('heading', { name: 'No communities yet' })).toBeVisible();
  expect(calls.find(c => c.name === 'ecolearn_delete_space')?.body).toEqual({ p_scope: 'community', p_scope_id: schoolId });
});

test('personal activity requests only the signed-in user scans and no admin statistics', async ({ page }) => {
  const { app, calls } = await signedIn(page, 'student');
  await app.openMoreSection('Profile');
  const scans = page.waitForRequest(r => new URL(r.url()).pathname.endsWith('/scan_history'));
  await page.getByRole('button', { name: 'My activity', exact: true }).click();
  expect(new URL((await scans).url()).searchParams.get('user_id')).toBe(`eq.${userId}`);
  await expect(page.getByRole('heading', { name: 'Personal analytics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Item demand and confusion' })).toHaveCount(0);
  expect(calls.some(c => c.name === 'get_item_interaction_analytics')).toBe(false);
});

test('administrator enrollment requires a valid code before management access appears', async ({ page }) => {
  const { app } = await signedIn(page, 'admin', false);
  await app.openMoreSection('Profile');
  await expect(page.getByRole('button', { name: 'Manage communities', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Set up authenticator', exact: true }).click();
  await expect(page.getByLabel('Authenticator setup key')).toHaveValue('LOCALTESTSECRET');
  await page.getByLabel('Authenticator code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Enable authenticator', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid authenticator code');
  await expect(page.getByRole('button', { name: 'Manage communities', exact: true })).toHaveCount(0);
  await page.getByLabel('Authenticator code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Enable authenticator', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manage communities', exact: true })).toBeVisible();
  await expect(page.getByLabel('Authenticator setup key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add backup authenticator' })).toBeVisible();
});

test('cancelled authenticator setup removes only the pending factor', async ({ page }) => {
  const { app, calls } = await signedIn(page, 'admin', false);
  await app.openMoreSection('Profile');
  await page.getByRole('button', { name: 'Set up authenticator', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel setup', exact: true }).click();
  await expect(page.getByLabel('Authenticator setup key')).toHaveCount(0);
  expect(calls.some(c => c.name === 'DELETE /auth/v1/factors/factor-test')).toBe(true);
});

test('a deleted community can be restored with its classroom', async ({ page }) => {
  const { app, calls } = await signedIn(page);
  await app.openPrimarySection('Community');
  await page.getByRole('button', { name: 'Delete community', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete Test school?' });
  await expect(dialog).toContainText('seven days');
  await dialog.getByRole('textbox').fill('Test school');
  await dialog.getByRole('button', { name: 'Move to recently deleted' }).click();
  await expect(page.getByRole('heading', { name: 'No communities yet' })).toBeVisible();
  await page.getByText('Recently deleted', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore Test school', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your classrooms' })).toBeVisible();
  await expect(page.getByText('No spaces awaiting deletion.')).toBeVisible();
  expect(calls.find(c => c.name === 'ecolearn_restore_space')?.body).toEqual({ p_scope: 'community', p_scope_id: schoolId });
});

test('deletion cancellation is safe; confirmed deletion removes classroom', async ({ page }) => {
  const { app, calls } = await signedIn(page); await app.openMoreSection('Schools');
  await page.getByRole('button', { name: 'Delete classroom', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(calls.some((call) => call.name === 'ecolearn_delete_space')).toBe(false);
  await page.getByRole('button', { name: 'Delete classroom', exact: true }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation.getByRole('button', { name: 'Move to recently deleted' })).toBeDisabled();
  await confirmation.getByRole('textbox').fill('Test classroom');
  await confirmation.getByRole('button', { name: 'Move to recently deleted' }).click();
  await expect(page.getByRole('heading', { name: 'No classrooms yet' })).toBeVisible();
  expect(calls.find((call) => call.name === 'ecolearn_delete_space')?.body).toEqual({ p_scope: 'classroom', p_scope_id: roomId });
});

test('students have no management actions and can open their assigned lesson directly', async ({ page }) => {
  const { app } = await signedIn(page, 'student'); await app.openMoreSection('Schools');
  await expect(page.getByRole('button', { name: 'Delete classroom', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete community', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Create a classroom' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Open assigned lesson' }).click();
  await expect(page).toHaveURL(new RegExp(`lesson=${lessonId}`));
  await expect(page.getByRole('heading', { name: 'Smarter compost habits' })).toBeVisible();
});

test('notification read state and opt-in preferences are saved through RPCs', async ({ page }) => {
  const { app, calls } = await signedIn(page); await app.openMoreSection('Notifications');
  await expect(page.getByRole('heading', { name: 'New assignment' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toHaveCount(0);
  expect(calls.find((call) => call.name === 'ecolearn_mark_notifications_read')?.body).toEqual({ p_id: noticeId });
  await expect(page.getByLabel('Email notifications', { exact: true })).not.toBeChecked();
  await page.getByLabel('Email notifications', { exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Notification preferences saved.')).toBeVisible();
  expect(calls.find((call) => call.name === 'ecolearn_set_notification_preferences')?.body).toMatchObject({ p_email: true, p_push: false });
});

test('home shows real activity and no fabricated impact chart', async ({ page }) => {
  const app = new EcoLearnPage(page); await app.goto();
  await expect(page.getByRole('heading', { name: 'Your learning activity' })).toBeVisible();
  await expect(page.getByText('kg CO₂ avoided')).toHaveCount(0);
  await expect(page.getByText('Weekly impact')).toHaveCount(0);
});
