import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getAuditLog, listAuditLogs } from '../controllers/admin/auditLogs.js';

/**
 * Top-level alias for the admin-scoped routes; the trail is admin-only either way.
 * The guard is attached per route rather than with router.use(), which would
 * also intercept every unmatched /api/* path and turn 404s into 401s.
 */
export const auditLogsRouter = Router();

auditLogsRouter.get('/', requireAdmin, listAuditLogs);
auditLogsRouter.get('/:id', requireAdmin, getAuditLog);
