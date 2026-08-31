import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { getMe } from '../controllers/users.js';

export const authRouter = Router();

authRouter.get('/auth/me', requireUser, getMe);
