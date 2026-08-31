import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { RequestHandler } from 'express';
import AdmZip from 'adm-zip';
import type { CompletionStatus, Prisma } from '@prisma/client';
import { prisma } from '../services/db.js';
import { auditContext, writeAudit } from '../services/audit.js';
import { extractPackage, readManifest, summariseStatement } from '../services/scorm.js';
import { loadOwnEnrollment, recalculateProgress } from '../services/progress.js';
import { env } from '../utils/env.js';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export const uploadScorm: RequestHandler = async (req, res) => {
  const file = req.file;
  const courseId = String((req.body as Record<string, unknown>)?.courseId ?? '');

  if (!file) throw fail(400, 'A .zip SCORM package is required');
  if (!/\.zip$/i.test(file.originalname)) throw fail(400, 'The upload must be a .zip file');
  if (!courseId) throw fail(400, 'courseId is required');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw fail(404, 'Course not found');
  if (req.user?.role !== 'admin' && course.ownerId !== req.user?.dbId) throw fail(403, 'Forbidden');

  let zip: AdmZip;
  try {
    zip = new AdmZip(file.buffer);
  } catch {
    throw fail(400, 'The upload is not a readable zip archive');
  }

  // Validate before writing anything to disk.
  const manifest = readManifest(zip);

  const scormId = randomUUID();
  await extractPackage(zip, scormId);

  const pkg = await prisma.scormPackage.create({
    data: {
      id: scormId,
      courseId,
      title: manifest.title,
      version: manifest.version,
      entryPoint: manifest.entryPoint,
      duration: manifest.duration,
      manifest: manifest.raw as Prisma.InputJsonValue,
      originalName: file.originalname,
      sizeBytes: file.size,
      uploadedById: req.user?.dbId ?? null,
    },
  });

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'scorm.upload',
    resourceType: 'course',
    resourceId: courseId,
    details: { scormId: pkg.id, title: pkg.title, version: pkg.version, sizeBytes: pkg.sizeBytes },
  });

  res.status(201).json({
    scormId: pkg.id,
    validated: true,
    manifest: {
      title: pkg.title,
      version: pkg.version,
      entryPoint: pkg.entryPoint,
      duration: pkg.duration,
    },
  });
};

/**
 * Issues a short-lived session token and the URL the player should load.
 *
 * ponytail: serves the locally extracted package. SCORM Cloud is the other
 * option in the spec, but it needs Rustici credentials we do not have; the
 * seam is SCORM_PLAYER_BASE_URL, so a Cloud launch slots in here.
 */
export const launchUrl: RequestHandler = async (req, res) => {
  const scormId = String(req.params.id);

  const pkg = await prisma.scormPackage.findUnique({ where: { id: scormId } });
  if (!pkg) throw fail(404, 'SCORM package not found');

  const enrollment = await loadOwnEnrollment(pkg.courseId, req.user?.dbId);

  const requested = req.query.enrollmentId;
  if (typeof requested === 'string' && requested && requested !== enrollment.id) {
    // Never launch someone else's registration, even for an admin.
    throw fail(403, 'That enrollment does not belong to you');
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.scormSession.create({
    data: { scormPackageId: pkg.id, enrollmentId: enrollment.id, token, expiresAt },
  });

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'scorm.launch',
    resourceType: 'course',
    resourceId: pkg.courseId,
    details: { scormId: pkg.id, enrollmentId: enrollment.id },
  });

  const base = env.SCORM_PLAYER_BASE_URL.replace(/\/$/, '');
  res.json({
    launchUrl: `${base}/api/scorm/${pkg.id}/content/${pkg.entryPoint}?token=${token}`,
    token,
    enrollmentId: enrollment.id,
    expiresAt: expiresAt.toISOString(),
  });
};

/** Serves an extracted package file. The token proves the caller launched it. */
export const serveContent: RequestHandler = async (req, res) => {
  const scormId = String(req.params.id);
  const token = String(req.query.token ?? '');
  const wildcard = (req.params as Record<string, string | string[]>).path;
  const requested = Array.isArray(wildcard) ? wildcard.join('/') : String(wildcard ?? '');

  const session = await prisma.scormSession.findUnique({
    where: { token },
    include: { scormPackage: true },
  });

  if (!session || session.scormPackageId !== scormId) throw fail(403, 'Invalid launch token');
  if (session.expiresAt < new Date()) throw fail(403, 'This launch session has expired');

  const root = path.resolve(process.cwd(), 'var/scorm', scormId);
  const target = path.resolve(root, requested);

  // The path comes from the URL: refuse anything resolving outside the package.
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw fail(400, 'Invalid content path');
  }

  res.sendFile(target, (err) => {
    if (err) res.status(404).json({ error: 'Content not found', requestId: req.requestId });
  });
};

const STATUS_RANK: Record<CompletionStatus, number> = {
  incomplete: 0,
  failed: 1,
  completed: 2,
  passed: 3,
};

export const track: RequestHandler = async (req, res) => {
  const scormId = String(req.params.id);
  const { statement, enrollmentId } = (req.body ?? {}) as Record<string, unknown>;

  const pkg = await prisma.scormPackage.findUnique({ where: { id: scormId } });
  if (!pkg) throw fail(404, 'SCORM package not found');

  const enrollment = await loadOwnEnrollment(pkg.courseId, req.user?.dbId);
  if (typeof enrollmentId === 'string' && enrollmentId && enrollmentId !== enrollment.id) {
    throw fail(403, 'That enrollment does not belong to you');
  }

  const summary = summariseStatement(statement);

  const existing = await prisma.scormTracking.findUnique({
    where: { enrollmentId_scormPackageId: { enrollmentId: enrollment.id, scormPackageId: pkg.id } },
  });

  const interactions = Array.isArray(existing?.interactions)
    ? (existing.interactions as Prisma.JsonArray)
    : [];
  if (summary.interaction) interactions.push(summary.interaction as Prisma.JsonObject);

  // Statements arrive out of order, so never downgrade a status or a score.
  const nextStatus =
    summary.completionStatus &&
    STATUS_RANK[summary.completionStatus] >= STATUS_RANK[existing?.completionStatus ?? 'incomplete']
      ? summary.completionStatus
      : (existing?.completionStatus ?? 'incomplete');

  const nextScore =
    summary.score === undefined
      ? (existing?.score ?? null)
      : Math.max(summary.score, existing?.score ?? 0);

  const tracking = await prisma.scormTracking.upsert({
    where: { enrollmentId_scormPackageId: { enrollmentId: enrollment.id, scormPackageId: pkg.id } },
    create: {
      enrollmentId: enrollment.id,
      scormPackageId: pkg.id,
      learnerId: enrollment.userId,
      score: nextScore,
      completionStatus: nextStatus,
      timeSpentSeconds: summary.durationSeconds ?? 0,
      interactions: interactions as Prisma.InputJsonValue,
    },
    update: {
      score: nextScore,
      completionStatus: nextStatus,
      ...(summary.durationSeconds
        ? { timeSpentSeconds: { increment: summary.durationSeconds } }
        : {}),
      interactions: interactions as Prisma.InputJsonValue,
      lastAccessedAt: new Date(),
    },
  });

  // A finished package completes the lesson that carries it, which is what
  // moves the course's own progress bar.
  if (nextStatus === 'completed' || nextStatus === 'passed') {
    const lesson = await prisma.courseContent.findFirst({
      where: { courseId: pkg.courseId, contentType: 'scorm' },
      orderBy: { orderIndex: 'asc' },
    });

    if (lesson) {
      await prisma.lessonCompletion.upsert({
        where: { enrollmentId_contentId: { enrollmentId: enrollment.id, contentId: lesson.id } },
        create: { enrollmentId: enrollment.id, contentId: lesson.id },
        update: {},
      });
    }

    const fresh = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    await recalculateProgress(fresh);
  }

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'scorm.track',
    resourceType: 'course',
    resourceId: pkg.courseId,
    details: {
      scormId: pkg.id,
      completionStatus: tracking.completionStatus,
      score: tracking.score,
    },
  });

  res.json({ recorded: true });
};

export const getTracking: RequestHandler = async (req, res) => {
  const scormId = String(req.params.id);

  const pkg = await prisma.scormPackage.findUnique({ where: { id: scormId } });
  if (!pkg) throw fail(404, 'SCORM package not found');

  const enrollment = await loadOwnEnrollment(pkg.courseId, req.user?.dbId);

  const tracking = await prisma.scormTracking.findUnique({
    where: { enrollmentId_scormPackageId: { enrollmentId: enrollment.id, scormPackageId: pkg.id } },
  });

  res.json({
    scormId: pkg.id,
    score: tracking?.score ?? null,
    completion_status: tracking?.completionStatus ?? 'incomplete',
    time_spent_seconds: tracking?.timeSpentSeconds ?? 0,
    interactions: tracking?.interactions ?? [],
    last_accessed_at: tracking?.lastAccessedAt?.toISOString() ?? null,
  });
};
