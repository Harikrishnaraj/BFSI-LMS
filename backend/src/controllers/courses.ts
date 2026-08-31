import type { RequestHandler } from 'express';
import type { CourseStatus, Difficulty, Prisma } from '@prisma/client';
import { prisma } from '../services/db.js';
import { auditContext, writeAudit } from '../services/audit.js';
import {
  COURSE_SUMMARY,
  cacheKey,
  invalidateCourseLists,
  readList,
  writeList,
} from '../services/courses.js';
import { parsePage, type Paginated } from '../utils/pagination.js';

const STATUSES: CourseStatus[] = ['draft', 'published', 'archived'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

const isStatus = (v: unknown): v is CourseStatus => STATUSES.includes(v as CourseStatus);
const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);

const fail = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

const TITLE_MAX = 255;

/**
 * Learners only ever see published courses, plus archived ones they are still
 * enrolled in. Instructors and admins see everything they own (admins: all).
 */
const visibilityFilter = async (
  role: string,
  dbId: string | undefined
): Promise<Prisma.CourseWhereInput> => {
  if (role === 'admin') return {};
  if (role === 'instructor') {
    return { OR: [{ ownerId: dbId ?? '' }, { status: 'published' }] };
  }

  return {
    OR: [
      { status: 'published' },
      // Archiving must not pull a course out from under an enrolled learner.
      { status: 'archived', enrollments: dbId ? { some: { userId: dbId } } : { none: {} } },
    ],
  };
};

export const listCourses: RequestHandler = async (req, res) => {
  const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>);
  const { category, status, search } = req.query as Record<string, string | undefined>;

  if (status && !isStatus(status)) throw fail(400, `Unknown status: ${status}`);

  const role = req.user?.role ?? 'learner';
  const visibility = await visibilityFilter(role, req.user?.dbId);

  const where: Prisma.CourseWhereInput = {
    AND: [
      visibility,
      ...(category ? [{ category: { equals: category, mode: 'insensitive' as const } }] : []),
      ...(isStatus(status) ? [{ status }] : []),
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
    ],
  };

  // Cache key includes the viewer's role and id: visibility differs per viewer.
  const key = cacheKey({ role, dbId: req.user?.dbId, page, pageSize, category, status, search });
  const cached = await readList<Paginated<unknown>>(key);
  if (cached) return void res.json(cached);

  const [data, total] = await Promise.all([
    prisma.course.findMany({
      where,
      select: COURSE_SUMMARY,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  const payload = { data, total, page, pageSize };
  await writeList(key, payload);
  res.json(payload);
};

export const getCourse: RequestHandler = async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: String(req.params.id) },
    select: {
      ...COURSE_SUMMARY,
      content: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!course) throw fail(404, 'Course not found');

  const role = req.user?.role ?? 'learner';
  const isOwner = course.ownerId === req.user?.dbId;

  if (role !== 'admin' && !isOwner && course.status !== 'published') {
    // Archived courses stay readable for learners who are already enrolled.
    const enrolled =
      course.status === 'archived' &&
      req.user?.dbId &&
      (await prisma.enrollment.count({
        where: { courseId: course.id, userId: req.user.dbId },
      })) > 0;

    if (!enrolled) throw fail(404, 'Course not found');
  }

  // assessments: the model lands with the assessment prompt; the key is here so
  // clients can rely on the shape now.
  res.json({ ...course, assessments: [] });
};

const validateCourseInput = (body: Record<string, unknown>, partial: boolean) => {
  const { title, category, difficulty } = body;

  if (!partial || title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) throw fail(400, 'Title is required');
    if (title.trim().length > TITLE_MAX) throw fail(400, `Title must be ${TITLE_MAX} characters or fewer`);
  }
  if (!partial || category !== undefined) {
    if (typeof category !== 'string' || !category.trim()) throw fail(400, 'Category is required');
  }
  if (difficulty !== undefined && !isDifficulty(difficulty)) {
    throw fail(400, `Difficulty must be one of ${DIFFICULTIES.join(', ')}`);
  }
};

export const createCourse: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  validateCourseInput(body, false);

  const course = await prisma.course.create({
    data: {
      title: (body.title as string).trim(),
      description: (body.description as string) || null,
      category: (body.category as string).trim(),
      isMandatory: Boolean(body.isMandatory ?? body.is_mandatory),
      complianceType: (body.complianceType as string) || (body.compliance_type as string) || null,
      targetAudience: (body.targetAudience as string) || (body.target_audience as string) || null,
      ...(isDifficulty(body.difficulty) ? { difficulty: body.difficulty } : {}),
      ownerId: req.user?.dbId ?? null,
    },
    select: COURSE_SUMMARY,
  });

  await invalidateCourseLists();
  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.create',
    resourceType: 'course',
    resourceId: course.id,
    details: { title: course.title, category: course.category },
  });

  res.status(201).json(course);
};

/** Owner or admin; anyone else gets 403 rather than a hint that the course exists. */
const loadEditable = async (req: Parameters<RequestHandler>[0]) => {
  const course = await prisma.course.findUnique({ where: { id: String(req.params.id) } });
  if (!course) throw fail(404, 'Course not found');

  const isOwner = course.ownerId === req.user?.dbId;
  if (req.user?.role !== 'admin' && !isOwner) throw fail(403, 'Forbidden');

  return course;
};

export const updateCourse: RequestHandler = async (req, res) => {
  const existing = await loadEditable(req);

  // Published courses are frozen: archive first, then edit a new version.
  if (existing.status !== 'draft') {
    throw fail(409, `A ${existing.status} course cannot be edited. Archive it first.`);
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  validateCourseInput(body, true);

  const course = await prisma.course.update({
    where: { id: existing.id },
    data: {
      ...(body.title !== undefined ? { title: (body.title as string).trim() } : {}),
      ...(body.description !== undefined ? { description: (body.description as string) || null } : {}),
      ...(body.category !== undefined ? { category: (body.category as string).trim() } : {}),
      ...(body.isMandatory !== undefined ? { isMandatory: Boolean(body.isMandatory) } : {}),
      ...(body.complianceType !== undefined
        ? { complianceType: (body.complianceType as string) || null }
        : {}),
      ...(body.targetAudience !== undefined
        ? { targetAudience: (body.targetAudience as string) || null }
        : {}),
      ...(isDifficulty(body.difficulty) ? { difficulty: body.difficulty } : {}),
    },
    select: COURSE_SUMMARY,
  });

  await invalidateCourseLists();
  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.update',
    resourceType: 'course',
    resourceId: course.id,
    details: { before: { title: existing.title, category: existing.category }, after: { title: course.title, category: course.category } },
  });

  res.json(course);
};

/** Soft delete: courses are archived, never removed, so history stays intact. */
export const archiveCourse: RequestHandler = async (req, res) => {
  const existing = await loadEditable(req);

  const course = await prisma.course.update({
    where: { id: existing.id },
    data: { status: 'archived' },
    select: COURSE_SUMMARY,
  });

  await invalidateCourseLists();
  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.archive',
    resourceType: 'course',
    resourceId: course.id,
    details: { from: existing.status },
  });

  res.json(course);
};

export interface PublishCheck {
  key: string;
  label: string;
  required: boolean;
  passed: boolean;
}

/** Shared by the publish endpoint and the UI's pre-flight checklist. */
export const publishChecks = async (courseId: string): Promise<PublishCheck[]> => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, description: true, _count: { select: { content: true } } },
  });
  if (!course) throw fail(404, 'Course not found');

  return [
    { key: 'title', label: 'Course title provided', required: true, passed: Boolean(course.title?.trim()) },
    { key: 'description', label: 'Description added', required: false, passed: Boolean(course.description?.trim()) },
    { key: 'content', label: 'At least 1 content item', required: true, passed: course._count.content > 0 },
    // Assessments arrive with the assessment prompt; optional either way.
    { key: 'assessment', label: 'Assessment created', required: false, passed: false },
  ];
};

export const getPublishChecks: RequestHandler = async (req, res) => {
  await loadEditable(req);
  const checks = await publishChecks(String(req.params.id));
  res.json({ checks, ready: checks.every((c) => !c.required || c.passed) });
};

export const publishCourse: RequestHandler = async (req, res) => {
  const existing = await loadEditable(req);

  if (existing.status === 'published') throw fail(409, 'Course is already published');
  if (existing.status === 'archived') throw fail(409, 'An archived course cannot be published');

  const checks = await publishChecks(existing.id);
  const failed = checks.filter((c) => c.required && !c.passed);
  if (failed.length > 0) {
    await writeAudit({
      ...auditContext(req),
      userId: req.user?.dbId,
      action: 'course.publish',
      resourceType: 'course',
      resourceId: existing.id,
      status: 'failure',
      errorMessage: 'Publish checks failed',
      details: { failed: failed.map((c) => c.key) },
    });
    return void res.status(400).json({
      error: 'Course is not ready to publish',
      checks,
      requestId: req.requestId,
    });
  }

  const course = await prisma.course.update({
    where: { id: existing.id },
    data: { status: 'published' },
    select: COURSE_SUMMARY,
  });

  await invalidateCourseLists();
  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.publish',
    resourceType: 'course',
    resourceId: course.id,
  });

  res.json(course);
};
