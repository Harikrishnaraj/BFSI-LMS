import { Router } from 'express';
import { requireRole, requireUser } from '../middleware/auth.js';
import {
  archiveCourse,
  createCourse,
  getCourse,
  getPublishChecks,
  listCourses,
  publishCourse,
  updateCourse,
} from '../controllers/courses.js';
import {
  addContent,
  deleteContent,
  reorderContent,
  updateContent,
} from '../controllers/courseContent.js';
import { enrol, getProgress, listEnrollments } from '../controllers/enrollments.js';

export const coursesRouter = Router();

// Authenticated; the handlers narrow visibility by role and ownership.
coursesRouter.get('/', requireUser, listCourses);
coursesRouter.get('/:id', requireUser, getCourse);

const authoring = [requireUser, requireRole('instructor', 'admin')];

coursesRouter.post('/', authoring, createCourse);
coursesRouter.put('/:id', authoring, updateCourse);
// Soft delete: archive, never remove.
coursesRouter.delete('/:id', authoring, archiveCourse);
coursesRouter.get('/:id/publish-checks', authoring, getPublishChecks);
coursesRouter.post('/:id/publish', authoring, publishCourse);

coursesRouter.post('/:id/content', authoring, addContent);
coursesRouter.put('/:id/content/:contentId', authoring, updateContent);
coursesRouter.delete('/:id/content/:contentId', authoring, deleteContent);
coursesRouter.post('/:id/content/reorder', authoring, reorderContent);

coursesRouter.get('/:id/enrollments', authoring, listEnrollments);

coursesRouter.post('/:id/enroll', requireUser, requireRole('learner'), enrol);
coursesRouter.get('/:id/progress', requireUser, getProgress);
