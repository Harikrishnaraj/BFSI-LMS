import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { prisma } from '../src/services/db.js';
import { createCourse, publishCourse } from '../src/controllers/courses.js';
import { addContent } from '../src/controllers/courseContent.js';
import { enrol } from '../src/controllers/enrollments.js';
import { completeLessonHandler, getCourseProgress, trackTime } from '../src/controllers/progress.js';
import { listUsers } from '../src/controllers/admin/users.js';
import { listAuditLogs } from '../src/controllers/admin/auditLogs.js';
import { connectRedis, redis } from '../src/services/redis.js';
import { getDashboardMetrics } from '../src/services/metrics.js';
import { cacheKey, invalidateCourseLists, readList, writeList } from '../src/services/courses.js';

/**
 * These run against a real Postgres and skip when one isn't reachable, so a
 * checkout without a database still passes the rest of the suite.
 *
 * Everything is created under a unique marker and removed afterwards, so the
 * tests can run against a developer database without leaving debris.
 */
const MARKER = `itest-${Date.now()}`;

let available = false;
let instructorId: string;
let learnerId: string;
let courseId: string;
let lessonIds: string[] = [];

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
    requestId: MARKER,
    query: {},
    params: {},
    body: {},
    ip: '127.0.0.1',
    get: () => 'integration-test',
    ...over,
  }) as any;

const asInstructor = (over: Record<string, unknown> = {}) =>
  makeReq({ user: { id: 'clerk-i', dbId: instructorId, role: 'instructor' }, ...over });

const asLearner = (over: Record<string, unknown> = {}) =>
  makeReq({ user: { id: 'clerk-l', dbId: learnerId, role: 'learner' }, ...over });

/** Connecting an already-open client throws, so only connect once. */
const redisReady = async (): Promise<boolean> => {
  if (redis.isOpen) return true;
  try {
    await connectRedis();
    return true;
  } catch {
    return false;
  }
};

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    available = true;
  } catch {
    console.log('No database reachable — skipping integration tests.');
    return;
  }

  const [instructor, learner] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${MARKER}-instructor@test.local`,
        name: 'Test Instructor',
        role: 'instructor',
        passwordHash: 'test-only',
      },
    }),
    prisma.user.create({
      data: {
        email: `${MARKER}-learner@test.local`,
        name: 'Test Learner',
        role: 'learner',
        passwordHash: 'test-only',
      },
    }),
  ]);

  instructorId = instructor.id;
  learnerId = learner.id;
});

after(async () => {
  if (redis.isOpen) await redis.quit();
  if (!available) return;

  // Audit rows null their user_id on delete, so clear ours by request id.
  await prisma.auditLog.deleteMany({ where: { requestId: MARKER } });
  if (courseId) await prisma.course.deleteMany({ where: { id: courseId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: MARKER } } });
  await prisma.$disconnect();
});

test('an instructor can create a course, add lessons and publish it', async (t) => {
  if (!available) return t.skip('no database');

  const created = makeRes();
  await createCourse(
    asInstructor({
      body: { title: `${MARKER} AML Basics`, category: 'Compliance', isMandatory: true },
    }),
    created,
    () => {}
  );

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.status, 'draft');
  courseId = created.body.id;

  // Publishing must fail while the course has no content.
  const tooEarly = makeRes();
  await publishCourse(asInstructor({ params: { id: courseId } }), tooEarly, () => {});
  assert.equal(tooEarly.statusCode, 400);

  for (const [i, title] of ['Introduction', 'Reporting obligations'].entries()) {
    const res = makeRes();
    await addContent(
      asInstructor({
        params: { id: courseId },
        body: { contentType: 'richtext', title, contentText: `Lesson ${i + 1} body` },
      }),
      res,
      () => {}
    );
    assert.equal(res.statusCode, 201);
    lessonIds.push(res.body.id);
  }

  const published = makeRes();
  await publishCourse(asInstructor({ params: { id: courseId } }), published, () => {});
  assert.equal(published.statusCode, 200);
  assert.equal(published.body.status, 'published');
});

test('a learner enrols once and is refused a second time', async (t) => {
  if (!available) return t.skip('no database');

  const first = makeRes();
  await enrol(asLearner({ params: { id: courseId } }), first, () => {});
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.learner_id, learnerId);

  await assert.rejects(
    () => enrol(asLearner({ params: { id: courseId } }), makeRes(), () => {}) as Promise<void>,
    (err: any) => err.status === 409
  );
});

test('completing lessons moves progress to 100% and marks the course complete', async (t) => {
  if (!available) return t.skip('no database');

  const half = makeRes();
  await completeLessonHandler(
    asLearner({ params: { id: courseId, lessonId: lessonIds[0] } }),
    half,
    () => {}
  );
  assert.equal(half.body.course_progress, 50);

  const done = makeRes();
  await completeLessonHandler(
    asLearner({ params: { id: courseId, lessonId: lessonIds[1] } }),
    done,
    () => {}
  );
  assert.equal(done.body.course_progress, 100);

  const progress = makeRes();
  await getCourseProgress(asLearner({ params: { id: courseId } }), progress, () => {});
  assert.equal(progress.body.status, 'completed');
  assert.equal(progress.body.lessons_completed, 2);
  assert.equal(progress.body.total_lessons, 2);
  assert.ok(progress.body.completed_at);
});

test('time tracking accumulates and is clamped per call', async (t) => {
  if (!available) return t.skip('no database');

  await trackTime(
    asLearner({ params: { id: courseId }, body: { seconds_since_last_update: 30 } }),
    makeRes(),
    () => {}
  );
  // Far above the per-call ceiling: only 300 of this should land.
  await trackTime(
    asLearner({ params: { id: courseId }, body: { seconds_since_last_update: 99999 } }),
    makeRes(),
    () => {}
  );

  const enrollment = await prisma.enrollment.findFirstOrThrow({
    where: { userId: learnerId, courseId },
  });
  assert.equal(enrollment.timeSpent, 330);
});

test('the actions taken above are all in the audit trail', async (t) => {
  if (!available) return t.skip('no database');

  const res = makeRes();
  await listAuditLogs(
    makeReq({
      user: { id: 'clerk-a', dbId: instructorId, role: 'admin' },
      query: { limit: '100' },
    }),
    res,
    () => {}
  );

  const mine = res.body.data.filter((row: any) => row.request_id === MARKER);
  const actions = new Set(mine.map((row: any) => row.action));

  for (const expected of [
    'course.create',
    'course.content.add',
    'course.publish',
    'course.enroll',
    'lesson_complete',
  ]) {
    assert.ok(actions.has(expected), `missing audit action: ${expected}`);
  }

  // The trail records who did it, against the real users table.
  const enrolRow = mine.find((row: any) => row.action === 'course.enroll');
  assert.equal(enrolRow.user_id, learnerId);
  assert.match(enrolRow.user_email, /learner@test\.local$/);
});

test('admin user search hits the real database', async (t) => {
  if (!available) return t.skip('no database');

  const res = makeRes();
  await listUsers(
    makeReq({
      user: { id: 'clerk-a', dbId: instructorId, role: 'admin' },
      query: { search: MARKER, limit: '10' },
    }),
    res,
    () => {}
  );

  assert.equal(res.body.total, 2);
  assert.equal(res.body.data.every((u: any) => !('passwordHash' in u)), true);
});

test('dashboard metrics are served from cache on the second call', async (t) => {
  if (!available) return t.skip('no database');

  if (!(await redisReady())) return t.skip('no redis');

  await redis.del('admin:dashboard:metrics');
  const first = await getDashboardMetrics();

  const cached = await redis.get('admin:dashboard:metrics');
  assert.ok(cached, 'metrics were not written to the cache');
  // The 5 minute TTL is the contract the frontend polls against.
  const ttl = await redis.ttl('admin:dashboard:metrics');
  assert.ok(ttl > 0 && ttl <= 300, `unexpected ttl: ${ttl}`);

  // Poison the cache: a second call returning the poisoned value proves the
  // read path is actually used rather than silently recomputing.
  await redis.set(
    'admin:dashboard:metrics',
    JSON.stringify({ ...first, totalUsers: 999_999 }),
    { EX: 300 }
  );
  assert.equal((await getDashboardMetrics()).totalUsers, 999_999);

  await redis.del('admin:dashboard:metrics');
});

test('course list caches are readable and cleared by invalidation', async (t) => {
  if (!available) return t.skip('no database');

  if (!(await redisReady())) return t.skip('no redis');

  const key = cacheKey({ marker: MARKER, page: 1 });
  await writeList(key, { data: ['cached'] });
  assert.deepEqual(await readList(key), { data: ['cached'] });

  // Any course mutation calls this; every cached list must go.
  await invalidateCourseLists();
  assert.equal(await readList(key), null);
});
