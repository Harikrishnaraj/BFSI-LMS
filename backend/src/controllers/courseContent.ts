import type { RequestHandler } from 'express';
import type { ContentType } from '@prisma/client';
import { prisma } from '../services/db.js';
import { auditContext, writeAudit } from '../services/audit.js';
import { invalidateCourseLists } from '../services/courses.js';

const TYPES: ContentType[] = ['video', 'pdf', 'richtext', 'scorm'];
const isType = (v: unknown): v is ContentType => TYPES.includes(v as ContentType);

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

/** Content is edited through its course, so ownership is checked on the course. */
const loadEditableCourse = async (req: Parameters<RequestHandler>[0]) => {
  const course = await prisma.course.findUnique({ where: { id: String(req.params.id) } });
  if (!course) throw fail(404, 'Course not found');

  const isOwner = course.ownerId === req.user?.dbId;
  if (req.user?.role !== 'admin' && !isOwner) throw fail(403, 'Forbidden');
  if (course.status !== 'draft') {
    throw fail(409, `Content cannot be changed on a ${course.status} course. Archive it first.`);
  }

  return course;
};

export const addContent: RequestHandler = async (req, res) => {
  const course = await loadEditableCourse(req);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const contentType = body.contentType ?? body.content_type;
  if (!isType(contentType)) throw fail(400, `contentType must be one of ${TYPES.join(', ')}`);
  if (typeof body.title !== 'string' || !body.title.trim()) throw fail(400, 'Content title is required');

  const fileUrl = (body.fileUrl ?? body.file_url) as string | undefined;
  const contentText = (body.contentText ?? body.content_text) as string | undefined;

  if (contentType === 'richtext' ? !contentText?.trim() : !fileUrl?.trim()) {
    throw fail(
      400,
      contentType === 'richtext' ? 'contentText is required for rich text' : 'fileUrl is required for this content type'
    );
  }

  // Append by default; the unique (course, order) index rejects collisions.
  const requested = Number(body.orderIndex ?? body.order_index);
  const orderIndex = Number.isFinite(requested)
    ? requested
    : await prisma.courseContent.count({ where: { courseId: course.id } });

  const content = await prisma.courseContent.create({
    data: {
      courseId: course.id,
      contentType,
      title: body.title.trim(),
      description: (body.description as string) || null,
      fileUrl: fileUrl?.trim() || null,
      contentText: contentText ?? null,
      orderIndex,
    },
  });

  await invalidateCourseLists();
  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.content.add',
    resourceType: 'course',
    resourceId: course.id,
    details: { contentId: content.id, contentType, title: content.title },
  });

  res.status(201).json(content);
};

export const updateContent: RequestHandler = async (req, res) => {
  const course = await loadEditableCourse(req);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const existing = await prisma.courseContent.findFirst({
    where: { id: String(req.params.contentId), courseId: course.id },
  });
  if (!existing) throw fail(404, 'Content not found');

  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
    throw fail(400, 'Content title is required');
  }

  const content = await prisma.courseContent.update({
    where: { id: existing.id },
    data: {
      ...(body.title !== undefined ? { title: (body.title as string).trim() } : {}),
      ...(body.description !== undefined ? { description: (body.description as string) || null } : {}),
      ...(body.fileUrl !== undefined ? { fileUrl: (body.fileUrl as string) || null } : {}),
      ...(body.contentText !== undefined ? { contentText: (body.contentText as string) || null } : {}),
      ...(body.orderIndex !== undefined ? { orderIndex: Number(body.orderIndex) } : {}),
    },
  });

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.content.update',
    resourceType: 'course',
    resourceId: course.id,
    details: { contentId: content.id },
  });

  res.json(content);
};

export const deleteContent: RequestHandler = async (req, res) => {
  const course = await loadEditableCourse(req);

  const existing = await prisma.courseContent.findFirst({
    where: { id: String(req.params.contentId), courseId: course.id },
  });
  if (!existing) throw fail(404, 'Content not found');

  await prisma.courseContent.delete({ where: { id: existing.id } });

  await invalidateCourseLists();
  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.content.delete',
    resourceType: 'course',
    resourceId: course.id,
    details: { contentId: existing.id, title: existing.title },
  });

  res.json({ success: true, contentId: existing.id });
};

export const reorderContent: RequestHandler = async (req, res) => {
  const course = await loadEditableCourse(req);
  const { order } = (req.body ?? {}) as { order?: unknown };

  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    throw fail(400, 'order must be an array of content ids');
  }

  const existing = await prisma.courseContent.findMany({
    where: { courseId: course.id },
    select: { id: true },
  });

  const known = new Set(existing.map((c) => c.id));
  if (order.length !== known.size || order.some((id) => !known.has(id as string))) {
    throw fail(400, 'order must list every content id in this course exactly once');
  }

  /*
   * Two passes inside one transaction: the (course_id, order_index) unique
   * index would otherwise trip on any swap. Negative indexes park the rows
   * somewhere no real ordering uses.
   */
  await prisma.$transaction([
    ...order.map((id, i) =>
      prisma.courseContent.update({ where: { id: id as string }, data: { orderIndex: -(i + 1) } })
    ),
    ...order.map((id, i) =>
      prisma.courseContent.update({ where: { id: id as string }, data: { orderIndex: i } })
    ),
  ]);

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'course.content.reorder',
    resourceType: 'course',
    resourceId: course.id,
    details: { order },
  });

  res.json({ success: true });
};
