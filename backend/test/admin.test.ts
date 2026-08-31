import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { prisma } from '../src/services/db.js';
import { requireRole } from '../src/middleware/auth.js';
import { createUser, deactivateUser, listUsers } from '../src/controllers/admin/users.js';
import { listAuditLogs } from '../src/controllers/admin/auditLogs.js';
import { toCsv } from '../src/utils/csv.js';
import { parsePage } from '../src/utils/pagination.js';


/**
 * Prisma's model delegates expose their methods through a proxy, so node:test's
 * mock.method() can't see them. Swap the whole delegate instead and record calls.
 */
type Call = { args: any[] };
const originals = new Map<string, PropertyDescriptor>();

const stub = (model: string, methods: Record<string, (...args: any[]) => unknown>) => {
  const client = prisma as any;
  if (!originals.has(model)) {
    originals.set(model, Object.getOwnPropertyDescriptor(client, model)!);
  }

  const calls: Record<string, Call[]> = {};
  const delegate: Record<string, unknown> = {};

  for (const [name, impl] of Object.entries(methods)) {
    calls[name] = [];
    delegate[name] = (...args: any[]) => {
      calls[name].push({ args });
      return impl(...args);
    };
  }

  Object.defineProperty(client, model, { value: delegate, configurable: true, writable: true });
  return calls;
};

const restore = () => {
  const client = prisma as any;
  for (const [model, descriptor] of originals) Object.defineProperty(client, model, descriptor);
  originals.clear();
};

/** Minimal res double: records the status and JSON body a handler produced. */
const makeRes = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const makeReq = (over: Record<string, unknown> = {}) =>
  ({
    requestId: 'test-request',
    query: {},
    params: {},
    body: {},
    ip: '10.0.0.1',
    get: () => 'node-test',
    user: { id: 'user_clerk', dbId: 'db-uuid', role: 'admin' },
    ...over,
  }) as any;

afterEach(restore);

test('parsePage clamps hostile paging', () => {
  assert.deepEqual(parsePage({ page: '3', limit: '20' }), { page: 3, pageSize: 20, skip: 40 });
  assert.equal(parsePage({ limit: '100000' }).pageSize, 200);
  assert.equal(parsePage({ page: '-5' }).page, 1);
  assert.equal(parsePage({ page: 'abc' }).page, 1);
});

test('listUsers applies role, department and search filters with pagination', async () => {
  const calls = stub('user', { findMany: async () => [], count: async () => 42 });

  const req = makeReq({ query: { page: '2', limit: '20', role: 'learner', department: 'Sales', search: 'john' } });
  const res = makeRes();
  await listUsers(req, res, () => {});

  const args = calls.findMany[0].args[0];
  assert.equal(args.skip, 20);
  assert.equal(args.take, 20);
  assert.equal(args.where.role, 'learner');
  assert.equal(args.where.department.equals, 'Sales');
  assert.deepEqual(
    args.where.OR.map((c: any) => Object.keys(c)[0]),
    ['name', 'email']
  );
  // password_hash must never be selectable through the admin API.
  assert.equal('passwordHash' in args.select, false);

  assert.equal(calls.count.length, 1);
  assert.deepEqual(res.body, { data: [], total: 42, page: 2, pageSize: 20 });
});

test('listUsers rejects an unknown role with 400', async () => {
  const res = makeRes();
  await listUsers(makeReq({ query: { role: 'wizard' } }), res, () => {});
  assert.equal(res.statusCode, 400);
});

test('createUser validates input before touching the database', async () => {
  const calls = stub('user', { findUnique: async () => null });

  for (const body of [
    { email: 'nope', name: 'A', role: 'admin' },
    { email: 'a@b.com', name: '   ', role: 'admin' },
    { email: 'a@b.com', name: 'A', role: 'wizard' },
  ]) {
    const res = makeRes();
    await createUser(makeReq({ body }), res, () => {});
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }

  assert.equal(calls.findUnique.length, 0);
});

test('createUser stores a hashed temporary password and writes an audit entry', async () => {
  const userCalls = stub('user', {
    findUnique: async () => null,
    create: async ({ data }: any) => ({
      id: 'new-uuid',
      email: data.email,
      name: data.name,
      role: data.role,
      department: data.department,
      isActive: true,
    }),
  });
  const auditCalls = stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await createUser(
    makeReq({ body: { email: 'new@bfsi.test', name: ' Nina New ', role: 'instructor', department: 'Risk' } }),
    res,
    () => {}
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.name, 'Nina New');
  assert.match(res.body.temporaryPassword, /^Tmp-.{12}!$/);

  const stored = userCalls.create[0].args[0].data;
  assert.match(stored.passwordHash, /^scrypt\$/);
  assert.notEqual(stored.passwordHash, res.body.temporaryPassword);

  const entry = auditCalls.create[0].args[0].data;
  assert.equal(entry.action, 'admin.user.create');
  assert.equal(entry.resourceId, 'new-uuid');
  assert.equal(entry.userId, 'db-uuid');
  assert.equal(entry.ipAddress, '10.0.0.1');
});

test('deactivateUser 404s for an unknown id and never writes', async () => {
  const calls = stub('user', { findUnique: async () => null, update: async () => ({}) });

  const res = makeRes();
  await deactivateUser(makeReq({ params: { id: 'missing' } }), res, () => {});

  assert.equal(res.statusCode, 404);
  assert.equal(calls.update.length, 0);
});

test('audit log filters map to a prisma where clause', async () => {
  const calls = stub('auditLog', { findMany: async () => [], count: async () => 0 });

  const req = makeReq({
    query: {
      userId: 'u1',
      action: 'login',
      result: 'failure',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-02-01T00:00:00Z',
      limit: '50',
    },
  });
  await listAuditLogs(req, makeRes(), () => {});

  const args = calls.findMany[0].args[0];
  assert.equal(args.where.userId, 'u1');
  assert.equal(args.where.action, 'login');
  assert.equal(args.where.status, 'failure');
  assert.equal(args.where.timestamp.gte.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.deepEqual(args.orderBy, { timestamp: 'desc' });
  assert.equal(args.take, 50);
});

test('audit log rejects an unparseable date and an unknown result', async () => {
  for (const query of [{ startDate: 'not-a-date' }, { result: 'maybe' }]) {
    await assert.rejects(
      () => listAuditLogs(makeReq({ query }), makeRes(), () => {}) as Promise<void>,
      (err: any) => err.status === 400
    );
  }
});

test('requireRole answers 403 for a non-admin and passes an admin through', () => {
  const guard = requireRole('admin');

  const denied = makeRes();
  let nexted = false;
  guard(makeReq({ user: { id: 'u', role: 'learner' } }), denied, () => {
    nexted = true;
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(nexted, false);

  guard(makeReq(), makeRes(), () => {
    nexted = true;
  });
  assert.equal(nexted, true);
});

test('csv export quotes separators, quotes and newlines', () => {
  const csv = toCsv([{ action: 'login,attempt', note: 'said "hi"\nagain' }]);
  assert.equal(csv, '"action","note"\r\n"login,attempt","said ""hi""\nagain"');
});
