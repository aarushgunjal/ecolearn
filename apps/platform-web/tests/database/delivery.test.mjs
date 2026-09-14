import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = (await readFile(new URL('../../supabase/functions/deliver-notifications/index.ts', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/, '');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function worker({ jobs = [], env = {}, fetcher, tickets = [] } = {}) {
  let handle; const calls = []; const writes = []; const requests = [];
  const db = {
    rpc: async (name) => { calls.push(name); return { data: name === 'ecolearn_claim_deliveries' ? jobs : null, error: null }; },
    from: (table) => {
      let action = 'select'; let value; const filters = [];
      const chain = {
        select: () => chain,
        update: (next) => { action = 'update'; value = next; return chain; },
        delete: () => { action = 'delete'; return chain; },
        eq: (...filter) => { filters.push(filter); return chain; },
        not: () => chain, lt: () => chain, gt: () => chain, limit: () => chain,
        then: (resolve) => { if (action !== 'select') writes.push({ table, action, value, filters }); return Promise.resolve({ data: action === 'select' ? tickets : null, error: null }).then(resolve); },
      };
      return chain;
    },
  };
  const settings = { SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only', NOTIFICATION_CRON_SECRET: 'cron-test-secret', ...env };
  new Function('Deno', 'createClient', 'fetch', code)({ env: { get: (key) => settings[key] }, serve: (next) => { handle = next; } }, () => db, async (url, init) => { requests.push({ url, init }); return fetcher ? fetcher(url, init) : Response.json({ id: 'email-id', data: { status: 'ok', id: 'push-ticket' } }); });
  return { run: (headers = { Authorization: 'Bearer cron-test-secret' }, method = 'POST') => handle(new Request('https://test.invalid/deliver', { method, headers })), calls, writes, requests };
}
const job = (channel) => ({ id: `${channel}-job`, lease_id: 'lease', channel, destination: channel === 'email' ? 'fixture@example.test' : 'ExpoPushToken[fixture]', notification_id: 'notice', title: 'Private class title', target_path: '/schools' });

test('delivery worker rejects unauthenticated requests before accessing the database', async () => {
  const w = worker(); assert.equal((await w.run({})).status, 401); assert.equal((await w.run({}, 'GET')).status, 405); assert.equal(w.calls.length, 0); assert.equal(w.requests.length, 0);
});
test('email and push delivery use saved destinations and acknowledge provider acceptance', async () => {
  const w = worker({ jobs: [job('email'), job('push')], env: { RESEND_API_KEY: 'test', NOTIFICATION_FROM_EMAIL: 'EcoLearn <updates@example.test>' } });
  const response = await w.run(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { accepted: 2, failed: 0 });
  assert.equal(w.requests.length, 2);
  const email = w.requests.find((r) => r.url.includes('resend'));
  assert.equal(email.init.headers['Idempotency-Key'], 'ecolearn-email-job');
  assert.deepEqual(JSON.parse(email.init.body).to, ['fixture@example.test']);
  assert.ok(JSON.parse(email.init.body).text.includes('To stop these emails'));
  assert.ok(w.requests.every((r) => !r.init.body.includes('Private class title')));
  assert.equal(w.writes.filter((write) => write.value?.delivered_at).length, 2);
  assert.ok(w.writes.every((write) => write.filters.some(([key, value]) => key === 'lease_id' && value === 'lease')));
});
test('missing email configuration never reports delivery success', async () => {
  const w = worker({ jobs: [job('email')] }); const response = await w.run();
  assert.equal(response.status, 502); assert.equal(w.requests.length, 0);
  assert.equal(w.writes[0].value.last_error, 'Email provider not configured');
  assert.ok(!w.writes[0].value.delivered_at); assert.ok(w.writes[0].value.available_at);
});
test('provider failures are retryable and invalid device tokens are removed', async () => {
  const w = worker({ jobs: [job('push')], fetcher: async () => Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }) });
  assert.equal((await w.run()).status, 502);
  assert.ok(w.writes.some((write) => write.table === 'ecolearn_push_devices' && write.action === 'delete'));
  assert.ok(w.writes.some((write) => write.value?.last_error === 'Push rejected: DeviceNotRegistered'));
  assert.ok(w.writes.every((write) => !write.value?.delivered_at));
});
test('push receipts remove uninstalled devices after initial ticket acceptance', async () => {
  const w = worker({ tickets: [{ id: 'delivery', provider_id: 'ticket', destination: 'ExpoPushToken[fixture]' }], fetcher: async () => Response.json({ data: { ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } } } }) });
  assert.equal((await w.run()).status, 200);
  assert.ok(w.writes.some((write) => write.action === 'delete'));
  assert.ok(w.writes.some((write) => write.value?.provider_id === null));
});
