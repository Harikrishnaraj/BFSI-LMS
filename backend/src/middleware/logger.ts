import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const logger: RequestHandler = (req, res, next) => {
  req.requestId = (req.header('x-request-id') as string) || randomUUID();
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    console.log(
      `${req.requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
};
