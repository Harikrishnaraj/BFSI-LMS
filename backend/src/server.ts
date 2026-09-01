import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { env } from './utils/env.js';
import { connectRedis } from './services/redis.js';
import { prisma } from './services/db.js';
import { cors } from './middleware/cors.js';
import { logger } from './middleware/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { webhookRouter } from './routes/webhooks.js';
import { adminRouter } from './routes/admin.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { coursesRouter } from './routes/courses.js';
import { instructorRouter } from './routes/instructor.js';
import { scormRouter } from './routes/scorm.js';
import { learnerRouter } from './routes/learner.js';

export const app = express();

app.use(logger);

// Before the routers: preflight requests must be answered without auth.
app.use(cors);

// Webhooks parse their own raw body and must run before express.json() consumes it.
app.use('/api', webhookRouter);

app.use(express.json());

// Health is mounted before auth so it stays up even if Clerk is misconfigured.
app.use('/api', healthRouter);

app.use(clerkMiddleware()); // populates req.auth; does not reject anonymous requests
app.use('/api', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/instructor', instructorRouter);
app.use('/api/scorm', scormRouter);
app.use('/api/learner', learnerRouter);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  // Redis is a cache, not a hard dependency: connect in the background so a
  // down/slow Redis never blocks the API from serving.
  void connectRedis().catch((err) => console.error('[redis] connect failed:', err));
  const server = app.listen(env.PORT, () =>
    console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`)
  );

  const shutdown = async () => {
    server.close();
    await Promise.allSettled([prisma.$disconnect()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

// Only boot when run directly, so tests can import `app` without opening a port.
if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start', err);
    process.exit(1);
  });
}
