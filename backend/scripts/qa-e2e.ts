/**
 * End-to-end QA harness: drives the running API with real Clerk session tokens.
 *
 *   npm run qa:e2e --workspace backend
 *
 * Deliberately not part of `npm test`. It needs three things the unit and
 * integration suites do not: a running server, real Clerk keys, and Clerk users
 * carrying admin and learner roles in publicMetadata. CI has none of those.
 *
 * It creates a course, uploads a SCORM package, publishes, enrols, launches,
 * posts an xAPI statement and checks the resulting progress and audit trail,
 * then deletes everything it made.
 */
import AdmZip from 'adm-zip';
import { createClerkClient } from '@clerk/express';
import { prisma } from '../src/services/db.js';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const API = 'http://localhost:3001';

let pass = 0;
let fail = 0;

const check = (label: string, condition: boolean, detail = '') => {
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  condition ? pass++ : fail++;
};

interface Actor {
  email: string;
  token: string;
  sessionId: string;
}

const actorFor = async (role: string): Promise<Actor> => {
  const { data } = await clerk.users.getUserList({ limit: 10 });
  const user = data.find((u) => (u.publicMetadata as any)?.role === role);
  if (!user) throw new Error(`no clerk user with role ${role}`);

  const session = await clerk.sessions.createSession({ userId: user.id });
  const { jwt } = await clerk.sessions.getToken(session.id, '');
  return { email: user.emailAddresses[0]!.emailAddress, token: jwt, sessionId: session.id };
};

const call = async (
  actor: Actor,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: any }> => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${actor.token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
};

/** A minimal but structurally valid SCORM 1.2 package. */
const buildPackage = (): ArrayBuffer => {
  const zip = new AdmZip();
  zip.addFile(
    'imsmanifest.xml',
    Buffer.from(`<?xml version="1.0"?>
<manifest identifier="qa-course" version="1.2">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations><organization><title>QA Compliance Module</title></organization></organizations>
  <resources><resource identifier="res1" href="index.html"/></resources>
</manifest>`)
  );
  zip.addFile('index.html', Buffer.from('<html><body><h1>QA module</h1></body></html>'));
  zip.addFile('assets/style.css', Buffer.from('body { color: navy }'));
  // A detached ArrayBuffer copy: Blob's DOM types reject a Node Buffer, whose
  // backing store is a shared pool rather than a plain ArrayBuffer.
  const bytes = zip.toBuffer();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

async function main() {
  const admin = await actorFor('admin');
  const learner = await actorFor('learner');
  console.log(`admin: ${admin.email}\nlearner: ${learner.email}\n`);

  console.log('== Authorisation matrix');
  check('admin reaches /api/admin/users', (await call(admin, 'GET', '/api/admin/users')).status === 200);
  check('admin reaches dashboard metrics', (await call(admin, 'GET', '/api/admin/dashboard/metrics')).status === 200);
  check('admin reaches audit logs', (await call(admin, 'GET', '/api/audit-logs')).status === 200);
  check('learner is refused admin users', (await call(learner, 'GET', '/api/admin/users')).status === 403);
  check('learner is refused instructor metrics', (await call(learner, 'GET', '/api/instructor/dashboard/metrics')).status === 403);
  check('learner reaches own dashboard', (await call(learner, 'GET', '/api/learner/dashboard')).status === 200);

  console.log('\n== Course lifecycle');
  const created = await call(admin, 'POST', '/api/courses', {
    title: `QA SCORM course ${Date.now()}`,
    category: 'Compliance',
    isMandatory: true,
  });
  check('admin creates a course', created.status === 201, `status ${created.status}`);
  const courseId = created.body.id;

  const hidden = await call(learner, 'GET', `/api/courses/${courseId}`);
  check('learner gets 404 (not 403) for a draft course', hidden.status === 404, `status ${hidden.status}`);

  const earlyEnrol = await call(learner, 'POST', `/api/courses/${courseId}/enroll`);
  check('learner cannot enrol in a draft course', earlyEnrol.status === 409, `status ${earlyEnrol.status}`);

  console.log('\n== SCORM upload');
  const form = new FormData();
  form.append('file', new Blob([buildPackage()]), 'qa-package.zip');
  form.append('courseId', courseId);

  const uploadRes = await fetch(`${API}/api/scorm/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin.token}` },
    body: form,
  });
  const upload = await uploadRes.json();
  check('package uploads and validates', uploadRes.status === 201, JSON.stringify(upload).slice(0, 120));
  check('manifest title is read', upload?.manifest?.title === 'QA Compliance Module', upload?.manifest?.title);
  check('launch file is read', upload?.manifest?.entryPoint === 'index.html', upload?.manifest?.entryPoint);
  const scormId = upload.scormId;

  const badUpload = await (async () => {
    const f = new FormData();
    f.append('file', new Blob(['not a zip']), 'notes.txt');
    f.append('courseId', courseId);
    return fetch(`${API}/api/scorm/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin.token}` },
      body: f,
    });
  })();
  check('a non-zip upload is rejected', badUpload.status === 400, `status ${badUpload.status}`);

  console.log('\n== Publish and enrol');
  const content = await call(admin, 'POST', `/api/courses/${courseId}/content`, {
    contentType: 'scorm',
    title: 'QA module',
    fileUrl: scormId,
  });
  check('scorm lesson added', content.status === 201, `status ${content.status}`);

  const published = await call(admin, 'POST', `/api/courses/${courseId}/publish`);
  check('course publishes', published.status === 200, `status ${published.status}`);

  const enrol = await call(learner, 'POST', `/api/courses/${courseId}/enroll`);
  check('learner enrols', enrol.status === 201, `status ${enrol.status}`);
  const enrollmentId = enrol.body.enrollment_id;

  console.log('\n== SCORM launch and tracking');
  const launch = await call(learner, 'POST', `/api/scorm/${scormId}/launch-url`);
  check('launch url issued', launch.status === 200, `status ${launch.status}`);

  const contentRes = await fetch(launch.body.launchUrl);
  const html = await contentRes.text();
  check('package content serves with the token', contentRes.status === 200 && html.includes('QA module'));

  const noToken = await fetch(`${API}/api/scorm/${scormId}/content/index.html`);
  check('content is refused without a token', noToken.status === 403, `status ${noToken.status}`);

  /*
   * Percent-encoded, because fetch normalises a raw ../ out of the path before
   * the request leaves the client — which makes the obvious version of this
   * test pass without the server guard ever running.
   */
  const traversal = await fetch(
    `${API}/api/scorm/${scormId}/content/%2e%2e%2f%2e%2e%2f%2e%2e%2f.env?token=${launch.body.token}`
  );
  check(
    'encoded path traversal is refused by the server guard',
    traversal.status === 400,
    `status ${traversal.status}`
  );

  const backslash = await fetch(
    `${API}/api/scorm/${scormId}/content/..%5c..%5c..%5c.env?token=${launch.body.token}`
  );
  check('encoded backslash traversal is refused', backslash.status === 400, `status ${backslash.status}`);

  const tracked = await call(learner, 'POST', `/api/scorm/${scormId}/track`, {
    enrollmentId,
    statement: {
      actor: { name: learner.email },
      verb: { id: 'http://adlnet.gov/expapi/verbs/passed' },
      object: { id: 'http://qa/course' },
      result: { score: { scaled: 0.92 }, duration: 'PT8M20S', completion: true, success: true },
    },
  });
  check('xAPI statement recorded', tracked.status === 200 && tracked.body.recorded === true);

  const tracking = await call(learner, 'GET', `/api/scorm/${scormId}/tracking`);
  check('score stored', tracking.body?.score === 92, `score ${tracking.body?.score}`);
  check('completion stored', tracking.body?.completion_status === 'passed', tracking.body?.completion_status);
  check('time spent stored', tracking.body?.time_spent_seconds === 500, `${tracking.body?.time_spent_seconds}s`);

  const progress = await call(learner, 'GET', `/api/courses/${courseId}/progress`);
  check('scorm completion drove course progress to 100%', progress.body?.progress_percentage === 100, `${progress.body?.progress_percentage}%`);
  check('course marked completed', progress.body?.status === 'completed', progress.body?.status);

  console.log('\n== Audit trail');
  const audit = await call(admin, 'GET', `/api/audit-logs?limit=100`);
  const actions = new Set((audit.body?.data ?? []).map((r: any) => r.action));
  for (const expected of ['course.create', 'scorm.upload', 'course.publish', 'course.enroll', 'scorm.launch', 'scorm.track']) {
    check(`audit records ${expected}`, actions.has(expected));
  }

  console.log('\n== Cleanup');
  await prisma.course.deleteMany({ where: { id: courseId } });
  await Promise.all([
    clerk.sessions.revokeSession(admin.sessionId),
    clerk.sessions.revokeSession(learner.sessionId),
  ]);
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exit(1);
});
