import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Not found', requestId: req.requestId });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = Number(err?.status ?? err?.statusCode) || 500;
  console.error(`${req.requestId} ${status}`, err);
  res.status(status).json({
    // Never leak internals on a 500.
    error: status >= 500 ? 'Internal server error' : err.message ?? 'Request failed',
    requestId: req.requestId,
  });
};
