import { Router } from 'express';
import multer from 'multer';
import { requireRole, requireUser } from '../middleware/auth.js';
import { MAX_UPLOAD_BYTES } from '../services/scorm.js';
import {
  getTracking,
  launchUrl,
  serveContent,
  track,
  uploadScorm,
} from '../controllers/scorm.js';

// In memory: the zip is validated before anything reaches disk, and the 500MB
// ceiling is enforced by multer rather than after a full write.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export const scormRouter = Router();

scormRouter.post(
  '/upload',
  requireUser,
  requireRole('instructor', 'admin'),
  upload.single('file'),
  uploadScorm
);

scormRouter.post('/:id/launch-url', requireUser, launchUrl);
scormRouter.post('/:id/track', requireUser, track);
scormRouter.get('/:id/tracking', requireUser, getTracking);

// Token-authorised: the player iframe loads these without a session cookie.
// Express 5 requires a named wildcard; params.path arrives as path segments.
scormRouter.get('/:id/content/*path', serveContent);
