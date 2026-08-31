import type { RequestHandler } from 'express';
import { getAuth } from '@clerk/express';

/**
 * Clerk verifies the session JWT against its JWKS in clerkMiddleware(); this
 * only gates the route. Clerk's own requireAuth() 302s to the sign-in page,
 * which is wrong for a JSON API — answer 401 instead.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: 'Unauthenticated', requestId: req.requestId });
    return;
  }
  next();
};

export { getAuth };
