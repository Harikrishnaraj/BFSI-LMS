import type { RequestHandler } from 'express';
import { prisma } from '../services/db.js';
import { toApiStatus } from '../services/progress.js';

const EXPIRING_SOON_DAYS = 30;

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

const requireLearnerId = (req: Parameters<RequestHandler>[0]): string => {
  const id = req.user?.dbId;
  if (!id) throw fail(403, 'Your account is not synced yet. Sign in again.');
  return id;
};

export type CertificateState = 'active' | 'expiring_soon' | 'expired';

const certificateState = (expiresAt: Date | null, now: Date): CertificateState => {
  if (!expiresAt) return 'active';
  if (expiresAt < now) return 'expired';
  return expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_DAYS * 86_400_000
    ? 'expiring_soon'
    : 'active';
};

export const dashboard: RequestHandler = async (req, res) => {
  const userId = requireLearnerId(req);
  const now = new Date();

  const [enrollments, certificates] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, category: true, isMandatory: true, complianceType: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.certificate.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true } } },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);

  const completed = enrollments.filter((e) => e.status === 'completed');
  const inProgress = enrollments.filter((e) => e.status === 'in_progress');

  const mandatory = enrollments
    .filter((e) => e.course.isMandatory)
    .map((e) => ({
      enrollmentId: e.id,
      course: e.course,
      status: toApiStatus(e.status),
      progress_percentage: e.progress,
      due_at: e.dueAt?.toISOString() ?? null,
      // Overdue is derived, so a missed deadline shows even before any job runs.
      overdue: Boolean(e.dueAt && e.dueAt < now && e.status !== 'completed'),
    }));

  res.json({
    coursesInProgress: inProgress.length,
    coursesCompleted: completed.length,
    // Hours, not seconds: the card shows hours and rounding here keeps it honest.
    learningHours: Math.round(enrollments.reduce((sum, e) => sum + e.timeSpent, 0) / 360) / 10,
    activeCertificates: certificates.filter(
      (c) => certificateState(c.expiresAt, now) !== 'expired'
    ).length,
    mandatoryCourses: mandatory,
    certificates: certificates.map((c) => ({
      id: c.id,
      course: c.course,
      issued_at: c.issuedAt.toISOString(),
      expires_at: c.expiresAt?.toISOString() ?? null,
      state: certificateState(c.expiresAt, now),
    })),
    continueCourseId: inProgress[0]?.courseId ?? null,
  });
};

/** The learner's own enrollments, keyed by course, for the browse page. */
export const myEnrollments: RequestHandler = async (req, res) => {
  const userId = requireLearnerId(req);

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { id: true, courseId: true, status: true, progress: true, timeSpent: true },
  });

  res.json({
    data: enrollments.map((e) => ({
      enrollmentId: e.id,
      course_id: e.courseId,
      status: toApiStatus(e.status),
      progress_percentage: e.progress,
      time_spent_seconds: e.timeSpent,
    })),
  });
};

export const listCertificates: RequestHandler = async (req, res) => {
  const userId = requireLearnerId(req);
  const now = new Date();

  const certificates = await prisma.certificate.findMany({
    where: { userId },
    include: { course: { select: { id: true, title: true, complianceType: true } } },
    orderBy: { issuedAt: 'desc' },
  });

  res.json({
    data: certificates.map((c) => ({
      id: c.id,
      course: c.course,
      issued_at: c.issuedAt.toISOString(),
      expires_at: c.expiresAt?.toISOString() ?? null,
      state: certificateState(c.expiresAt, now),
    })),
  });
};
