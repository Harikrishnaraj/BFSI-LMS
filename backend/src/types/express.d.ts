import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /** Set by requireUser from the verified Clerk session claims. */
      user?: {
        /** Clerk user id (the JWT subject). */
        id: string;
        /** users.id — what audit_logs.user_id references. Absent until synced. */
        dbId?: string;
        email?: string;
        role: Role;
      };
    }
  }
}

export {};
