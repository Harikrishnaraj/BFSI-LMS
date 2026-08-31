import type { Enrollment, EnrollmentStatus } from '@prisma/client';
import { prisma } from './db.js';

/**
 * The API speaks the spec's vocabulary ('not_started'); the database keeps
 * Prisma's enum ('assigned'). Translate at the boundary rather than migrating
 * a value that only differs in name.
 */
export type ApiStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export const toApiStatus = (status: EnrollmentStatus): ApiStatus =>
  status === 'assigned' ? 'not_started' : status;

export interface ProgressSnapshot {
  enrollmentId: string;
  course_id: string;
  progress_percentage: number;
  time_spent_seconds: number;
  status: ApiStatus;
  completed_at: string | null;
  lessons_completed: number;
  total_lessons: number;
}

/**
 * Progress is the share of lessons completed.
 *
 * ponytail: when assessments land, this becomes
 * (lessons * 0.7) + (assessment_passed * 0.3) — the split the spec asks for.
 * With no assessment model yet, weighting against a value that is always zero
 * would cap every learner at 70%.
 */
export const recalculateProgress = async (enrollment: Enrollment): Promise<ProgressSnapshot> => {
  const [totalLessons, lessonsCompleted] = await Promise.all([
    prisma.courseContent.count({ where: { courseId: enrollment.courseId } }),
    prisma.lessonCompletion.count({ where: { enrollmentId: enrollment.id } }),
  ]);

  const percentage =
    totalLessons === 0 ? 0 : Math.round((lessonsCompleted / totalLessons) * 100);

  // Only ever moves forward into completed; re-opening is a separate action.
  const status: EnrollmentStatus =
    percentage >= 100 ? 'completed' : percentage > 0 ? 'in_progress' : enrollment.status;

  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progress: percentage,
      status,
      completedAt:
        status === 'completed' ? (enrollment.completedAt ?? new Date()) : enrollment.completedAt,
    },
  });

  return {
    enrollmentId: updated.id,
    course_id: updated.courseId,
    progress_percentage: updated.progress,
    time_spent_seconds: updated.timeSpent,
    status: toApiStatus(updated.status),
    completed_at: updated.completedAt?.toISOString() ?? null,
    lessons_completed: lessonsCompleted,
    total_lessons: totalLessons,
  };
};

/** Loads the caller's own enrollment, or throws 403/404. */
export const loadOwnEnrollment = async (courseId: string, userId: string | undefined) => {
  if (!userId) {
    throw Object.assign(new Error('Your account is not synced yet. Sign in again.'), { status: 403 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    throw Object.assign(new Error('You are not enrolled in this course'), { status: 403 });
  }

  return enrollment;
};
