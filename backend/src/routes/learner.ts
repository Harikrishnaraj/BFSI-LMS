import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { dashboard, listCertificates, myEnrollments } from '../controllers/learner.js';

export const learnerRouter = Router();

learnerRouter.get('/dashboard', requireUser, dashboard);
learnerRouter.get('/enrollments', requireUser, myEnrollments);
learnerRouter.get('/certificates', requireUser, listCertificates);
