import type { RequestHandler } from 'express';

/**
 * The API and the web app are separate origins (3001 and 3000), so every
 * browser-side call is cross-origin and needs these headers. Server-rendered
 * calls from Next never do, which is why this was missing for so long.
 *
 * Authentication is a Bearer token, not a cookie, so credentials stay off and
 * the allow-list can be exact rather than a wildcard.
 */
const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const cors: RequestHandler = (req, res, next) => {
  const origin = req.get('origin');

  if (origin && allowed.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    // Caches keyed on the request origin, so one origin's response is never
    // served to another.
    res.setHeader('vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'authorization,content-type,x-request-id');
    res.setHeader('access-control-max-age', '86400');
    res.status(204).end();
    return;
  }

  next();
};
