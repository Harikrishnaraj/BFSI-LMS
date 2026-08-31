import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /** Set by requireUser from the verified Clerk session claims. */
      user?: { id: string; email?: string; role: Role };
    }
  }
}

export {};
