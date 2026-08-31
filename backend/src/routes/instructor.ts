import { Router } from 'express';
import { requireRole, requireUser } from '../middleware/auth.js';
import { instructorMetrics } from '../controllers/enrollments.js';

export const instructorRouter = Router();

instructorRouter.get(
  '/dashboard/metrics',
  requireUser,
  requireRole('instructor', 'admin'),
  instructorMetrics
);
