import { prisma } from './db.js';
import { redis } from './redis.js';

export interface DashboardMetrics {
  totalUsers: number;
  activeCourses: number;
  completionRate: number;
  complianceStatus: { compliant: number; atRisk: number; nonCompliant: number };
  certificatesExpiringSoon: number;
  lastUpdate: string;
}

const CACHE_KEY = 'admin:dashboard:metrics';
const TTL_SECONDS = 300; // 5 minutes
const EXPIRING_SOON_DAYS = 30;
const AT_RISK_DAYS = 7;

/**
 * A learner is compliant when no mandatory enrollment is outstanding, at risk
 * when one is due within a week, and non-compliant once one is overdue.
 */
const computeMetrics = async (): Promise<DashboardMetrics> => {
  const now = new Date();
  const atRiskCutoff = new Date(now.getTime() + AT_RISK_DAYS * 86_400_000);
  const expiryCutoff = new Date(now.getTime() + EXPIRING_SOON_DAYS * 86_400_000);
  const mandatory = { course: { isMandatory: true } };

  const [totalUsers, activeCourses, totalMandatory, completedMandatory, certificatesExpiringSoon] =
    await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.course.count({ where: { status: 'published' } }),
      prisma.enrollment.count({ where: mandatory }),
      prisma.enrollment.count({ where: { ...mandatory, status: 'completed' } }),
      prisma.certificate.count({ where: { expiresAt: { gte: now, lte: expiryCutoff } } }),
    ]);

  const [overdueUsers, atRiskUsers] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        ...mandatory,
        status: { not: 'completed' },
        OR: [{ status: 'overdue' }, { dueAt: { lt: now } }],
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.enrollment.findMany({
      where: {
        ...mandatory,
        status: { not: 'completed' },
        dueAt: { gte: now, lte: atRiskCutoff },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const nonCompliant = new Set(overdueUsers.map((e) => e.userId));
  // Overdue wins: a user with both an overdue and an upcoming course is not
  // "at risk", they are already non-compliant.
  const atRisk = new Set(atRiskUsers.map((e) => e.userId).filter((id) => !nonCompliant.has(id)));

  return {
    totalUsers,
    activeCourses,
    completionRate: totalMandatory === 0 ? 0 : completedMandatory / totalMandatory,
    complianceStatus: {
      compliant: Math.max(0, totalUsers - nonCompliant.size - atRisk.size),
      atRisk: atRisk.size,
      nonCompliant: nonCompliant.size,
    },
    certificatesExpiringSoon,
    lastUpdate: now.toISOString(),
  };
};

/** Cached for 5 minutes; a Redis outage degrades to a live query, never an error. */
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as DashboardMetrics;
  } catch (err) {
    console.error('[metrics] cache read failed', err);
  }

  const metrics = await computeMetrics();

  try {
    await redis.set(CACHE_KEY, JSON.stringify(metrics), { EX: TTL_SECONDS });
  } catch (err) {
    console.error('[metrics] cache write failed', err);
  }

  return metrics;
};

/** Course-level rollup behind the admin compliance table. */
export const getCourseCompliance = async () => {
  const courses = await prisma.course.findMany({
    where: { isMandatory: true, status: { not: 'archived' } },
    select: {
      id: true,
      title: true,
      category: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { title: 'asc' },
  });

  const completions = await prisma.enrollment.groupBy({
    by: ['courseId'],
    where: { status: 'completed', course: { isMandatory: true } },
    _count: { _all: true },
  });

  const completedByCourse = new Map(completions.map((c) => [c.courseId, c._count._all]));

  return courses.map((course) => {
    const assigned = course._count.enrollments;
    const completed = completedByCourse.get(course.id) ?? 0;
    return {
      id: course.id,
      title: course.title,
      category: course.category,
      assigned,
      completed,
      completionRate: assigned === 0 ? 0 : completed / assigned,
    };
  });
};
