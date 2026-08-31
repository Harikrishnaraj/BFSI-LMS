import type { RequestHandler } from 'express';
import { getAuth } from '@clerk/express';
import type { Role } from '@prisma/client';

const isRole = (v: unknown): v is Role =>
  v === 'admin' || v === 'instructor' || v === 'learner';

/**
 * Clerk verifies the session JWT against its JWKS inside clerkMiddleware();
 * this reads the verified claims onto req.user and gates the route.
 *
 * Clerk's own requireAuth() 302s to a sign-in page, which is wrong for a JSON
 * API, so we answer 401 instead.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthenticated', requestId: req.requestId });
    return;
  }

  const claims = (sessionClaims ?? {}) as { email?: unknown; role?: unknown };

  req.user = {
    id: userId,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    // Least privilege: an absent or unrecognised claim is never an admin.
    role: isRole(claims.role) ? claims.role : 'learner',
  };

  next();
};

/**
 * Route-level authorisation. Mount after requireUser:
 *   router.get('/users', requireUser, requireRole('admin'), handler)
 */
export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated', requestId: req.requestId });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', requestId: req.requestId });
      return;
    }
    next();
  };

export { getAuth };
