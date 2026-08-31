import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export const SCORM_ROOT = path.resolve(process.cwd(), 'var/scorm');
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB

export interface ScormManifest {
  title: string;
  version: string;
  entryPoint: string;
  duration?: number;
  raw: unknown;
}

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/** ISO 8601 duration (PT1H30M) or SCORM 1.2 HH:MM:SS to seconds. */
export const parseDuration = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  const iso = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(
    value.trim()
  );
  if (iso) {
    const [, , , days, hours, minutes, seconds] = iso;
    return (
      Number(days ?? 0) * 86400 +
      Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Math.round(Number(seconds ?? 0))
    );
  }

  const clock = /^(\d+):(\d{1,2}):([\d.]+)$/.exec(value.trim());
  if (clock) {
    return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Math.round(Number(clock[3]));
  }

  return undefined;
};

const first = <T>(value: T | T[] | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Reads imsmanifest.xml and pulls out what the player and the catalogue need.
 * Handles both bare and namespaced element names, since packages differ.
 */
export const readManifest = (zip: AdmZip): ScormManifest => {
  const entry = zip.getEntry('imsmanifest.xml');
  if (!entry) throw fail(400, 'Not a SCORM package: imsmanifest.xml is missing');

  let parsed: Record<string, any>;
  try {
    parsed = parser.parse(zip.readAsText(entry));
  } catch {
    throw fail(400, 'imsmanifest.xml is not valid XML');
  }

  const manifest = parsed.manifest ?? parsed['imscp:manifest'];
  if (!manifest) throw fail(400, 'imsmanifest.xml has no <manifest> element');

  const schemaVersion =
    manifest.metadata?.schemaversion ?? manifest.metadata?.['imscp:schemaversion'];
  const organizations = manifest.organizations ?? manifest['imscp:organizations'];
  const organization = first(organizations?.organization ?? organizations?.['imscp:organization']);

  const resources = manifest.resources ?? manifest['imscp:resources'];
  const resourceList = resources?.resource ?? resources?.['imscp:resource'];
  const launchable = (Array.isArray(resourceList) ? resourceList : [resourceList])
    .filter(Boolean)
    .find((r: any) => r?.['@_href']);

  const entryPoint = launchable?.['@_href'];
  if (typeof entryPoint !== 'string' || !entryPoint) {
    throw fail(400, 'The manifest declares no launchable resource');
  }

  // A package can point its launch file outside its own directory only by
  // traversal, which would escape the extraction root when served.
  if (entryPoint.includes('..') || path.isAbsolute(entryPoint)) {
    throw fail(400, 'The manifest launch path is not inside the package');
  }

  return {
    title:
      (typeof organization?.title === 'string' ? organization.title : undefined) ??
      (typeof manifest.metadata?.lom?.general?.title?.langstring === 'string'
        ? manifest.metadata.lom.general.title.langstring
        : undefined) ??
      'Untitled SCORM package',
    version: String(schemaVersion ?? manifest['@_version'] ?? 'unknown'),
    entryPoint,
    duration: parseDuration(
      manifest.metadata?.lom?.technical?.duration?.datetime ??
        organization?.['imsss:sequencing']?.['imsss:limitConditions']?.['@_attemptAbsoluteDurationLimit']
    ),
    raw: manifest.metadata ?? {},
  };
};

/**
 * Extracts the package under var/scorm/<id>. Entries that would escape that
 * directory are rejected rather than skipped: a package containing one is
 * malicious, not merely malformed.
 */
export const extractPackage = async (zip: AdmZip, scormId: string): Promise<string> => {
  const target = path.join(SCORM_ROOT, scormId);

  for (const entry of zip.getEntries()) {
    const resolved = path.resolve(target, entry.entryName);
    if (resolved !== target && !resolved.startsWith(target + path.sep)) {
      throw fail(400, `Package contains an unsafe path: ${entry.entryName}`);
    }
  }

  await mkdir(target, { recursive: true });
  try {
    zip.extractAllTo(target, true);
  } catch (err) {
    await rm(target, { recursive: true, force: true });
    throw err;
  }

  return target;
};

export interface XapiSummary {
  completionStatus?: 'incomplete' | 'completed' | 'passed' | 'failed';
  score?: number;
  durationSeconds?: number;
  interaction?: Record<string, unknown>;
}

const VERBS: Record<string, XapiSummary['completionStatus']> = {
  'http://adlnet.gov/expapi/verbs/completed': 'completed',
  'http://adlnet.gov/expapi/verbs/passed': 'passed',
  'http://adlnet.gov/expapi/verbs/failed': 'failed',
  'http://adlnet.gov/expapi/verbs/experienced': 'incomplete',
  'http://adlnet.gov/expapi/verbs/attempted': 'incomplete',
  'http://adlnet.gov/expapi/verbs/initialized': 'incomplete',
};

/** Validates the parts of an xAPI statement we act on, and summarises them. */
export const summariseStatement = (statement: unknown): XapiSummary => {
  if (!statement || typeof statement !== 'object') throw fail(400, 'statement must be an object');

  const s = statement as Record<string, any>;
  const verbId = s.verb?.id;
  if (typeof verbId !== 'string') throw fail(400, 'statement.verb.id is required');
  if (!s.actor) throw fail(400, 'statement.actor is required');
  if (!s.object) throw fail(400, 'statement.object is required');

  const summary: XapiSummary = { completionStatus: VERBS[verbId] };

  const result = s.result;
  if (result?.completion === true && !summary.completionStatus) summary.completionStatus = 'completed';
  if (result?.success === true) summary.completionStatus = 'passed';
  if (result?.success === false && summary.completionStatus !== 'completed') {
    summary.completionStatus = 'failed';
  }

  const scaled = result?.score?.scaled;
  const raw = result?.score?.raw;
  const max = result?.score?.max;

  if (typeof scaled === 'number') {
    summary.score = Math.round(Math.min(1, Math.max(0, scaled)) * 100);
  } else if (typeof raw === 'number') {
    const ceiling = typeof max === 'number' && max > 0 ? max : 100;
    summary.score = Math.round(Math.min(100, Math.max(0, (raw / ceiling) * 100)));
  }

  summary.durationSeconds = parseDuration(result?.duration);

  // Interaction statements carry their own object id; keep them for the report.
  if (s.object?.definition?.interactionType) {
    summary.interaction = {
      id: s.object.id,
      type: s.object.definition.interactionType,
      response: result?.response ?? null,
      success: result?.success ?? null,
      at: s.timestamp ?? new Date().toISOString(),
    };
  }

  return summary;
};
