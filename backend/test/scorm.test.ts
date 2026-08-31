import assert from 'node:assert/strict';
import test from 'node:test';
import AdmZip from 'adm-zip';
import { parseDuration, readManifest, summariseStatement } from '../src/services/scorm.js';

const manifestXml = (inner: string) => `<?xml version="1.0"?>
<manifest identifier="course" version="1.3">
  <metadata><schemaversion>2004 4th Edition</schemaversion></metadata>
  ${inner}
</manifest>`;

const validPackage = () => {
  const zip = new AdmZip();
  zip.addFile(
    'imsmanifest.xml',
    Buffer.from(
      manifestXml(`
  <organizations><organization><title>AML Essentials</title></organization></organizations>
  <resources><resource identifier="r1" href="index.html"/></resources>`)
    )
  );
  zip.addFile('index.html', Buffer.from('<html></html>'));
  return zip;
};

test('a valid package yields its title, version and launch file', () => {
  const manifest = readManifest(validPackage());
  assert.equal(manifest.title, 'AML Essentials');
  assert.equal(manifest.version, '2004 4th Edition');
  assert.equal(manifest.entryPoint, 'index.html');
});

test('a zip without a manifest is rejected as not-SCORM', () => {
  const zip = new AdmZip();
  zip.addFile('readme.txt', Buffer.from('nope'));
  assert.throws(() => readManifest(zip), (err: any) => err.status === 400);
});

test('a manifest with no launchable resource is rejected', () => {
  const zip = new AdmZip();
  zip.addFile('imsmanifest.xml', Buffer.from(manifestXml('<resources><resource identifier="r1"/></resources>')));
  assert.throws(() => readManifest(zip), (err: any) => err.status === 400);
});

test('a manifest whose launch path escapes the package is rejected', () => {
  const zip = new AdmZip();
  zip.addFile(
    'imsmanifest.xml',
    Buffer.from(manifestXml('<resources><resource identifier="r1" href="../../etc/passwd"/></resources>'))
  );
  assert.throws(() => readManifest(zip), (err: any) => err.status === 400);
});

test('malformed xml is a 400, not a crash', () => {
  const zip = new AdmZip();
  zip.addFile('imsmanifest.xml', Buffer.from('<manifest><oops>'));
  assert.throws(() => readManifest(zip), (err: any) => err.status === 400);
});

test('durations parse from ISO 8601 and SCORM clock format', () => {
  assert.equal(parseDuration('PT1H30M'), 5400);
  assert.equal(parseDuration('PT45S'), 45);
  assert.equal(parseDuration('01:30:00'), 5400);
  assert.equal(parseDuration('nonsense'), undefined);
  assert.equal(parseDuration(undefined), undefined);
});

test('xAPI statements must carry a verb, an actor and an object', () => {
  for (const statement of [
    null,
    'string',
    { actor: {}, object: {} },
    { verb: { id: 'http://x' }, object: {} },
    { verb: { id: 'http://x' }, actor: {} },
  ]) {
    assert.throws(() => summariseStatement(statement), (err: any) => err.status === 400);
  }
});

test('a passed statement scores from scaled, raw, or a custom max', () => {
  const base = { actor: { name: 'l' }, object: { id: 'http://course' } };

  assert.equal(
    summariseStatement({
      ...base,
      verb: { id: 'http://adlnet.gov/expapi/verbs/passed' },
      result: { score: { scaled: 0.87 } },
    }).score,
    87
  );

  assert.equal(
    summariseStatement({
      ...base,
      verb: { id: 'http://adlnet.gov/expapi/verbs/completed' },
      result: { score: { raw: 18, max: 20 } },
    }).score,
    90
  );

  // Out-of-range scaled values are clamped rather than trusted.
  assert.equal(
    summariseStatement({
      ...base,
      verb: { id: 'http://adlnet.gov/expapi/verbs/passed' },
      result: { score: { scaled: 4 } },
    }).score,
    100
  );
});

test('completion status follows the verb, and success overrides it', () => {
  const base = { actor: { name: 'l' }, object: { id: 'http://course' } };

  assert.equal(
    summariseStatement({ ...base, verb: { id: 'http://adlnet.gov/expapi/verbs/completed' } })
      .completionStatus,
    'completed'
  );
  assert.equal(
    summariseStatement({
      ...base,
      verb: { id: 'http://adlnet.gov/expapi/verbs/completed' },
      result: { success: false },
    }).completionStatus,
    'completed'
  );
  assert.equal(
    summariseStatement({
      ...base,
      verb: { id: 'http://adlnet.gov/expapi/verbs/attempted' },
      result: { success: false },
    }).completionStatus,
    'failed'
  );
  assert.equal(
    summariseStatement({ ...base, verb: { id: 'http://example.com/verbs/unknown' } })
      .completionStatus,
    undefined
  );
});

test('interaction statements are captured with their response', () => {
  const summary = summariseStatement({
    actor: { name: 'l' },
    verb: { id: 'http://adlnet.gov/expapi/verbs/answered' },
    object: {
      id: 'http://course/q1',
      definition: { interactionType: 'choice' },
    },
    result: { response: 'b', success: true },
    timestamp: '2026-08-31T10:30:00Z',
  });

  assert.deepEqual(summary.interaction, {
    id: 'http://course/q1',
    type: 'choice',
    response: 'b',
    success: true,
    at: '2026-08-31T10:30:00Z',
  });
});

test('duration on a result is read as time spent', () => {
  const summary = summariseStatement({
    actor: { name: 'l' },
    verb: { id: 'http://adlnet.gov/expapi/verbs/completed' },
    object: { id: 'http://course' },
    result: { duration: 'PT12M30S' },
  });
  assert.equal(summary.durationSeconds, 750);
});
