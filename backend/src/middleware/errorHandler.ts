import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Not found', requestId: req.requestId });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Multer rejects oversized or malformed uploads with its own error class,
  // which carries no status: those are the caller's fault, not a 500.
  const status =
    err?.name === 'MulterError'
      ? 400
      : Number(err?.status ?? err?.statusCode) || 500;
  console.error(`${req.requestId} ${status}`, err);
  res.status(status).json({
    // Never leak internals on a 500.
    error:
      status >= 500
        ? 'Internal server error'
        : err?.code === 'LIMIT_FILE_SIZE'
          ? 'The file is larger than the 500MB limit'
          : (err.message ?? 'Request failed'),
    requestId: req.requestId,
  });
};
