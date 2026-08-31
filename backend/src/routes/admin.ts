import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { courseCompliance, dashboardMetrics } from '../controllers/admin/metrics.js';
import {
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/admin/users.js';
import {
  downloadReport,
  exportAuditLogs,
  getAuditLog,
  listAuditLogs,
} from '../controllers/admin/auditLogs.js';

export const adminRouter = Router();

// Every route below is admin-only.
adminRouter.use(requireAdmin);

adminRouter.get('/dashboard/metrics', dashboardMetrics);
adminRouter.get('/dashboard/compliance', courseCompliance);

adminRouter.get('/users', listUsers);
adminRouter.post('/users', createUser);
adminRouter.get('/users/:id', getUser);
adminRouter.put('/users/:id', updateUser);
adminRouter.post('/users/:id/deactivate', deactivateUser);

adminRouter.get('/audit-logs', listAuditLogs);
adminRouter.post('/audit-logs/export', exportAuditLogs);
adminRouter.get('/audit-logs/reports/:reportId', downloadReport);
adminRouter.get('/audit-logs/:id', getAuditLog);
