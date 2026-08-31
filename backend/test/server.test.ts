import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import type { Server } from 'node:http';
import { app } from '../src/server.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

let base: string;
let server: Server;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
});

after(() => server.close());

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('unknown route returns 404 json with request id', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: string; requestId: string };
  assert.equal(body.error, 'Not found');
  assert.ok(body.requestId);
});

test('errorHandler hides internals on 500 but keeps 4xx messages', () => {
  const capture = () => {
    const res: any = {
      code: 0,
      body: null,
      status(c: number) { this.code = c; return this; },
      json(b: unknown) { this.body = b; return this; },
    };
    return res;
  };

  const serverErr = capture();
  errorHandler(new Error('db password leaked'), { requestId: 'r1' } as any, serverErr, () => {});
  assert.equal(serverErr.code, 500);
  assert.deepEqual(serverErr.body, { error: 'Internal server error', requestId: 'r1' });

  const clientErr = capture();
  errorHandler(
    Object.assign(new Error('bad input'), { status: 400 }),
    { requestId: 'r2' } as any,
    clientErr,
    () => {}
  );
  assert.equal(clientErr.code, 400);
  assert.deepEqual(clientErr.body, { error: 'bad input', requestId: 'r2' });
});

test('clerk webhook rejects an unsigned payload without touching the db', async () => {
  const res = await fetch(`${base}/api/webhooks/clerk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'user.created', data: { id: 'user_forged' } }),
  });
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, 'Invalid webhook signature');
});

test('GET /api/auth/me requires authentication', async () => {
  const res = await fetch(`${base}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('admin endpoints reject anonymous callers with 401', async () => {
  for (const path of [
    '/api/admin/dashboard/metrics',
    '/api/admin/users',
    '/api/admin/audit-logs',
    '/api/audit-logs',
  ]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 401, path);
  }
});

test('admin user creation rejects anonymous callers before validating the body', async () => {
  const res = await fetch(`${base}/api/admin/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  assert.equal(res.status, 401);
});
