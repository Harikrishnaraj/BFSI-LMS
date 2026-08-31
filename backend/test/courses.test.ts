import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { prisma } from '../src/services/db.js';
import {
  archiveCourse,
  createCourse,
  getCourse,
  listCourses,
  publishCourse,
  updateCourse,
} from '../src/controllers/courses.js';
import { addContent, reorderContent } from '../src/controllers/courseContent.js';
import { enrol } from '../src/controllers/enrollments.js';

/**
 * Prisma's model delegates hide their methods behind a proxy, so node:test's
 * mock.method() can't see them. Swap the whole delegate and record calls.
 */
const originals = new Map<string, PropertyDescriptor>();

const stub = (model: string, methods: Record<string, (...args: any[]) => unknown>) => {
  const client = prisma as any;
  if (!originals.has(model)) {
    originals.set(model, Object.getOwnPropertyDescriptor(client, model)!);
  }

  const calls: Record<string, { args: any[] }[]> = {};
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

afterEach(() => {
  const client = prisma as any;
  for (const [model, descriptor] of originals) Object.defineProperty(client, model, descriptor);
  originals.clear();
});

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
    user: { id: 'clerk_1', dbId: 'instructor-uuid', role: 'instructor' },
    ...over,
  }) as any;

const course = (over: Record<string, unknown> = {}) => ({
  id: 'course-uuid',
  title: 'AML Basics',
  description: 'Desc',
  category: 'Compliance',
  status: 'draft',
  ownerId: 'instructor-uuid',
  ...over,
});

test('learners only see published courses, plus archived ones they are enrolled in', async () => {
  const calls = stub('course', { findMany: async () => [], count: async () => 0 });

  await listCourses(makeReq({ user: { id: 'c', dbId: 'learner-uuid', role: 'learner' } }), makeRes(), () => {});

  const where = calls.findMany[0].args[0].where;
  const visibility = where.AND[0];
  assert.deepEqual(visibility.OR[0], { status: 'published' });
  assert.equal(visibility.OR[1].status, 'archived');
  assert.deepEqual(visibility.OR[1].enrollments, { some: { userId: 'learner-uuid' } });
});

test('admins see every course unfiltered', async () => {
  const calls = stub('course', { findMany: async () => [], count: async () => 0 });

  await listCourses(makeReq({ user: { id: 'c', dbId: 'admin-uuid', role: 'admin' } }), makeRes(), () => {});

  assert.deepEqual(calls.findMany[0].args[0].where.AND[0], {});
});

test('a learner gets 404, not 403, for a draft course they cannot see', async () => {
  stub('course', { findUnique: async () => course({ status: 'draft', ownerId: 'someone-else' }) });
  stub('enrollment', { count: async () => 0 });

  await assert.rejects(
    () =>
      getCourse(
        makeReq({ params: { id: 'course-uuid' }, user: { id: 'c', dbId: 'learner-uuid', role: 'learner' } }),
        makeRes(),
        () => {}
      ) as Promise<void>,
    (err: any) => err.status === 404
  );
});

test('createCourse rejects a missing title, an over-long title and a missing category', async () => {
  const calls = stub('course', { create: async () => course() });

  for (const body of [
    { category: 'Compliance' },
    { title: 'x'.repeat(256), category: 'Compliance' },
    { title: 'Fine' },
  ]) {
    await assert.rejects(
      () => createCourse(makeReq({ body }), makeRes(), () => {}) as Promise<void>,
      (err: any) => err.status === 400
    );
  }

  assert.equal(calls.create.length, 0);
});

test('createCourse starts in draft and records an audit entry', async () => {
  const courseCalls = stub('course', { create: async ({ data }: any) => course({ ...data, id: 'new-course' }) });
  const auditCalls = stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await createCourse(
    makeReq({ body: { title: '  KYC Refresher ', category: 'Compliance', isMandatory: true } }),
    res,
    () => {}
  );

  assert.equal(res.statusCode, 201);
  const data = courseCalls.create[0].args[0].data;
  assert.equal(data.title, 'KYC Refresher');
  assert.equal(data.ownerId, 'instructor-uuid');
  // status is not set explicitly: the schema default of 'draft' owns it.
  assert.equal(data.status, undefined);

  assert.equal(auditCalls.create[0].args[0].data.action, 'course.create');
});

test('a published course cannot be edited, and a stranger cannot edit at all', async () => {
  stub('course', { findUnique: async () => course({ status: 'published' }) });
  await assert.rejects(
    () => updateCourse(makeReq({ params: { id: 'course-uuid' }, body: { title: 'New' } }), makeRes(), () => {}) as Promise<void>,
    (err: any) => err.status === 409
  );

  originals.forEach((d, m) => Object.defineProperty(prisma as any, m, d));
  originals.clear();

  stub('course', { findUnique: async () => course({ ownerId: 'another-instructor' }) });
  await assert.rejects(
    () => updateCourse(makeReq({ params: { id: 'course-uuid' }, body: { title: 'New' } }), makeRes(), () => {}) as Promise<void>,
    (err: any) => err.status === 403
  );
});

test('delete archives rather than removing the row', async () => {
  const calls = stub('course', {
    findUnique: async () => course(),
    update: async ({ data }: any) => course({ status: data.status }),
    delete: async () => ({}),
  });
  stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await archiveCourse(makeReq({ params: { id: 'course-uuid' } }), res, () => {});

  assert.equal(calls.delete.length, 0);
  assert.equal(calls.update[0].args[0].data.status, 'archived');
  assert.equal(res.body.status, 'archived');
});

test('publish is refused without content and returns the failing checklist', async () => {
  stub('course', {
    findUnique: async ({ select }: any) =>
      select?._count
        ? { title: 'AML Basics', description: 'Desc', _count: { content: 0 } }
        : course(),
    update: async () => course({ status: 'published' }),
  });
  stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await publishCourse(makeReq({ params: { id: 'course-uuid' } }), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.checks.find((c: any) => c.key === 'content').passed, false);
  // The optional description check passing must not make the course publishable.
  assert.equal(res.body.checks.find((c: any) => c.key === 'description').passed, true);
});

test('publish succeeds once a content item exists', async () => {
  const calls = stub('course', {
    findUnique: async ({ select }: any) =>
      select?._count
        ? { title: 'AML Basics', description: 'Desc', _count: { content: 2 } }
        : course(),
    update: async ({ data }: any) => course({ status: data.status }),
  });
  stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await publishCourse(makeReq({ params: { id: 'course-uuid' } }), res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(calls.update[0].args[0].data.status, 'published');
});

test('an already published course cannot be published again', async () => {
  stub('course', { findUnique: async () => course({ status: 'published' }) });

  await assert.rejects(
    () => publishCourse(makeReq({ params: { id: 'course-uuid' } }), makeRes(), () => {}) as Promise<void>,
    (err: any) => err.status === 409
  );
});

test('content requires a title and the payload its type needs', async () => {
  stub('course', { findUnique: async () => course() });
  const calls = stub('courseContent', { create: async () => ({}), count: async () => 0 });

  for (const body of [
    { contentType: 'video', fileUrl: 'https://x/v.mp4' },
    { contentType: 'nonsense', title: 'T' },
    { contentType: 'video', title: 'T' },
    { contentType: 'richtext', title: 'T' },
  ]) {
    await assert.rejects(
      () => addContent(makeReq({ params: { id: 'course-uuid' }, body }), makeRes(), () => {}) as Promise<void>,
      (err: any) => err.status === 400
    );
  }

  assert.equal(calls.create.length, 0);
});

test('content is appended at the end when no order is given', async () => {
  stub('course', { findUnique: async () => course() });
  const calls = stub('courseContent', {
    count: async () => 3,
    create: async ({ data }: any) => ({ id: 'content-uuid', ...data }),
  });
  stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await addContent(
    makeReq({
      params: { id: 'course-uuid' },
      body: { contentType: 'pdf', title: 'Policy', fileUrl: 'https://x/p.pdf' },
    }),
    res,
    () => {}
  );

  assert.equal(res.statusCode, 201);
  assert.equal(calls.create[0].args[0].data.orderIndex, 3);
});

test('reorder rejects a partial list and renumbers in two passes otherwise', async () => {
  stub('course', { findUnique: async () => course() });
  stub('courseContent', {
    findMany: async () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    update: async () => ({}),
  });
  const tx: any[][] = [];
  Object.defineProperty(prisma as any, '$transaction', {
    value: async (ops: any[]) => {
      tx.push(ops);
      return [];
    },
    configurable: true,
    writable: true,
  });
  stub('auditLog', { create: async () => ({}) });

  await assert.rejects(
    () =>
      reorderContent(
        makeReq({ params: { id: 'course-uuid' }, body: { order: ['a', 'b'] } }),
        makeRes(),
        () => {}
      ) as Promise<void>,
    (err: any) => err.status === 400
  );

  const res = makeRes();
  await reorderContent(
    makeReq({ params: { id: 'course-uuid' }, body: { order: ['c', 'a', 'b'] } }),
    res,
    () => {}
  );

  assert.equal(res.body.success, true);
  // Six updates: park on negative indexes, then settle on the real ones, so the
  // (course_id, order_index) unique index never sees a collision mid-swap.
  assert.equal(tx[0].length, 6);
});

test('enrolment is refused twice, and on a course that is not published', async () => {
  stub('course', { findUnique: async () => course({ status: 'published' }) });
  stub('enrollment', { findUnique: async () => ({ id: 'existing' }), create: async () => ({}) });

  await assert.rejects(
    () => enrol(makeReq({ params: { id: 'course-uuid' }, user: { id: 'c', dbId: 'learner', role: 'learner' } }), makeRes(), () => {}) as Promise<void>,
    (err: any) => err.status === 409
  );

  originals.forEach((d, m) => Object.defineProperty(prisma as any, m, d));
  originals.clear();

  stub('course', { findUnique: async () => course({ status: 'draft' }) });
  stub('enrollment', { findUnique: async () => null, create: async () => ({}) });

  await assert.rejects(
    () => enrol(makeReq({ params: { id: 'course-uuid' }, user: { id: 'c', dbId: 'learner', role: 'learner' } }), makeRes(), () => {}) as Promise<void>,
    (err: any) => err.status === 409
  );
});

test('a first enrolment returns the enrollment payload and audits it', async () => {
  stub('course', { findUnique: async () => course({ status: 'published' }) });
  stub('enrollment', {
    findUnique: async () => null,
    create: async ({ data }: any) => ({
      id: 'enrollment-uuid',
      courseId: data.courseId,
      userId: data.userId,
      status: 'assigned',
      createdAt: new Date('2026-08-31T10:30:00Z'),
    }),
  });
  const auditCalls = stub('auditLog', { create: async () => ({}) });

  const res = makeRes();
  await enrol(
    makeReq({ params: { id: 'course-uuid' }, user: { id: 'c', dbId: 'learner-uuid', role: 'learner' } }),
    res,
    () => {}
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    enrollment_id: 'enrollment-uuid',
    course_id: 'course-uuid',
    learner_id: 'learner-uuid',
    status: 'assigned',
    enrolled_at: '2026-08-31T10:30:00.000Z',
  });
  assert.equal(auditCalls.create[0].args[0].data.action, 'course.enroll');
  assert.equal(auditCalls.create[0].args[0].data.resourceId, 'course-uuid');
});
