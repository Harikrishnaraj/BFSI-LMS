import type { RequestHandler } from 'express';
import type { EnrollmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../services/db.js';
import { auditContext, writeAudit } from '../services/audit.js';
import { parsePage } from '../utils/pagination.js';

const STATUSES: EnrollmentStatus[] = ['assigned', 'in_progress', 'completed', 'overdue'];
const isStatus = (v: unknown): v is EnrollmentStatus => STATUSES.includes(v as EnrollmentStatus);

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

export const enrol: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const userId = req.user?.dbId;
  if (!userId) throw fail(403, 'Your account is not synced yet. Sign in again.');

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true, title: true },
  });
  if (!course) throw fail(404, 'Course not found');

  // Draft is invisible; archived is view-only for those already enrolled.
  if (course.status !== 'published') {
    throw fail(409, `A ${course.status} course cannot be enrolled in`);
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw fail(409, 'You are already enrolled in this course');

  const enrollment = await prisma.enrollment.create({
    data: { userId, courseId },
  });

  await writeAudit({
    ...auditContext(req),
    userId,
    action: 'course.enroll',
    resourceType: 'course',
    resourceId: courseId,
    details: { enrollmentId: enrollment.id, title: course.title },
  });

  res.status(201).json({
    enrollment_id: enrollment.id,
    course_id: enrollment.courseId,
    learner_id: enrollment.userId,
    status: enrollment.status,
    enrolled_at: enrollment.createdAt.toISOString(),
  });
};

/** Course owner or admin: the roster is not learner-visible. */
export const listEnrollments: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>);
  const { status } = req.query as Record<string, string | undefined>;

  if (status && !isStatus(status)) throw fail(400, `Unknown status: ${status}`);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, ownerId: true },
  });
  if (!course) throw fail(404, 'Course not found');
  if (req.user?.role !== 'admin' && course.ownerId !== req.user?.dbId) throw fail(403, 'Forbidden');

  const where: Prisma.EnrollmentWhereInput = {
    courseId,
    ...(isStatus(status) ? { status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      select: {
        id: true,
        status: true,
        progress: true,
        timeSpent: true,
        dueAt: true,
        completedAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.enrollment.count({ where }),
  ]);

  res.json({
    data: rows.map((row) => ({
      enrollment_id: row.id,
      user: row.user,
      status: row.status,
      progress_percentage: row.progress,
      time_spent: row.timeSpent,
      due_at: row.dueAt?.toISOString() ?? null,
      completed_at: row.completedAt?.toISOString() ?? null,
      enrolled_at: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });
};

/** A learner's own progress in one course. */
export const getProgress: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const userId = req.user?.dbId;
  if (!userId) throw fail(403, 'Your account is not synced yet. Sign in again.');

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) throw fail(404, 'You are not enrolled in this course');

  res.json({
    enrollment_id: enrollment.id,
    course_id: enrollment.courseId,
    progress_percentage: enrollment.progress,
    time_spent: enrollment.timeSpent,
    status: enrollment.status,
    completed_at: enrollment.completedAt?.toISOString() ?? null,
  });
};

/** Metrics behind the instructor dashboard, scoped to the caller's own courses. */
export const instructorMetrics: RequestHandler = async (req, res) => {
  const ownerId = req.user?.dbId;
  const scope = req.user?.role === 'admin' ? {} : { ownerId: ownerId ?? '' };

  const courses = await prisma.course.findMany({ where: scope, select: { id: true } });
  const courseIds = courses.map((c) => c.id);

  const [enrollments, activeLearners, completed] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: { userId: true, status: true },
    }),
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: 'in_progress' },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.enrollment.count({ where: { courseId: { in: courseIds }, status: 'completed' } }),
  ]);

  res.json({
    myCourses: courseIds.length,
    totalStudents: new Set(enrollments.map((e) => e.userId)).size,
    activeLearners: activeLearners.length,
    avgCompletion: enrollments.length === 0 ? 0 : completed / enrollments.length,
  });
};
