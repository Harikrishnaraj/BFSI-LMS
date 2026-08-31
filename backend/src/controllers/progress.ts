import type { RequestHandler } from 'express';
import { prisma } from '../services/db.js';
import { auditContext, writeAudit } from '../services/audit.js';
import { loadOwnEnrollment, recalculateProgress, toApiStatus } from '../services/progress.js';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

const MAX_TICK_SECONDS = 300; // a 30s heartbeat; anything larger is a bad client

export const getCourseProgress: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const enrollment = await loadOwnEnrollment(courseId, req.user?.dbId);
  res.json(await recalculateProgress(enrollment));
};

export const postCourseProgress: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const { action, lesson_id: lessonId, time_spent: timeSpent } = (req.body ?? {}) as Record<string, unknown>;

  if (action !== 'start' && action !== 'complete') {
    throw fail(400, "action must be 'start' or 'complete'");
  }

  const enrollment = await loadOwnEnrollment(courseId, req.user?.dbId);

  if (action === 'start') {
    // Resuming a finished course must not knock it back to in progress.
    if (enrollment.status === 'assigned') {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'in_progress' },
      });
    }

    await writeAudit({
      ...auditContext(req),
      userId: req.user?.dbId,
      action: 'course_start',
      resourceType: 'course',
      resourceId: courseId,
      details: { enrollmentId: enrollment.id },
    });
  } else {
    if (typeof lessonId === 'string' && lessonId) {
      await completeLesson(enrollment.id, courseId, lessonId);
    } else {
      // Completing the course means completing everything left in it.
      const lessons = await prisma.courseContent.findMany({
        where: { courseId },
        select: { id: true },
      });
      await prisma.lessonCompletion.createMany({
        data: lessons.map((l) => ({ enrollmentId: enrollment.id, contentId: l.id })),
        skipDuplicates: true,
      });
    }
  }

  if (typeof timeSpent === 'number' && Number.isFinite(timeSpent) && timeSpent > 0) {
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { timeSpent: { increment: Math.min(MAX_TICK_SECONDS, Math.round(timeSpent)) } },
    });
  }

  const fresh = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
  const snapshot = await recalculateProgress(fresh);

  if (action === 'complete' && snapshot.status === 'completed') {
    await writeAudit({
      ...auditContext(req),
      userId: req.user?.dbId,
      action: 'course_complete',
      resourceType: 'course',
      resourceId: courseId,
      details: { enrollmentId: enrollment.id, timeSpentSeconds: snapshot.time_spent_seconds },
    });
  }

  res.json(snapshot);
};

const completeLesson = async (enrollmentId: string, courseId: string, contentId: string) => {
  const lesson = await prisma.courseContent.findFirst({ where: { id: contentId, courseId } });
  if (!lesson) throw fail(404, 'Lesson not found in this course');

  // Replaying a completion is not an error; the unique index makes it a no-op.
  await prisma.lessonCompletion.upsert({
    where: { enrollmentId_contentId: { enrollmentId, contentId } },
    create: { enrollmentId, contentId },
    update: {},
  });
};

export const completeLessonHandler: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const lessonId = String(req.params.lessonId);

  const enrollment = await loadOwnEnrollment(courseId, req.user?.dbId);
  await completeLesson(enrollment.id, courseId, lessonId);

  const fresh = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
  const snapshot = await recalculateProgress(fresh);

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'lesson_complete',
    resourceType: 'course',
    resourceId: courseId,
    details: {
      lessonId,
      enrollmentId: enrollment.id,
      progress: snapshot.progress_percentage,
      timeSpentSeconds: snapshot.time_spent_seconds,
    },
  });

  res.json({
    lessonId,
    completed_at: new Date().toISOString(),
    course_progress: snapshot.progress_percentage,
  });
};

/** Lesson list with the caller's completion state folded in. */
export const listLessons: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const enrollment = await loadOwnEnrollment(courseId, req.user?.dbId);

  const [lessons, completions] = await Promise.all([
    prisma.courseContent.findMany({ where: { courseId }, orderBy: { orderIndex: 'asc' } }),
    prisma.lessonCompletion.findMany({ where: { enrollmentId: enrollment.id } }),
  ]);

  const completedAt = new Map(completions.map((c) => [c.contentId, c.completedAt]));

  res.json({
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      type: lesson.contentType,
      fileUrl: lesson.fileUrl,
      contentText: lesson.contentText,
      orderIndex: lesson.orderIndex,
      completed_at: completedAt.get(lesson.id)?.toISOString() ?? null,
    })),
    status: toApiStatus(enrollment.status),
  });
};

/**
 * Heartbeat from the player. Clamped so a queue flushed after a long offline
 * spell can't book hours of study time in one call.
 */
export const trackTime: RequestHandler = async (req, res) => {
  const courseId = String(req.params.id);
  const { seconds_since_last_update: seconds } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    throw fail(400, 'seconds_since_last_update must be a positive number');
  }

  const enrollment = await loadOwnEnrollment(courseId, req.user?.dbId);

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { timeSpent: { increment: Math.min(MAX_TICK_SECONDS, Math.round(seconds)) } },
  });

  res.json({ acknowledged: true });
};
