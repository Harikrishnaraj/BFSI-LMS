import type { Request } from 'express';
import type { AuditStatus, Prisma } from '@prisma/client';
import { prisma } from './db.js';

export interface AuditInput {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status?: AuditStatus;
  errorMessage?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * INSERT only — audit_logs is immutable. Never add update or delete helpers
 * here; the trail is the compliance evidence.
 *
 * Failures are logged and swallowed: an unwritable audit row must not turn a
 * successful admin action into a 500 that the caller then retries.
 */
export const writeAudit = async (input: AuditInput): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        status: input.status ?? 'success',
        errorMessage: input.errorMessage,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write entry', input.action, err);
  }
};

/** Pulls the request-scoped fields every admin action should record. */
export const auditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
  requestId: req.requestId,
});
