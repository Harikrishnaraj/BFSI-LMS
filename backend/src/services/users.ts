import type { Prisma, Role, User } from '@prisma/client';
import { clerkClient } from '@clerk/express';
import { prisma } from './db.js';
import { writeAudit } from './audit.js';

const ROLES = ['admin', 'instructor', 'learner'] as const;

const toRole = (value: unknown): Role | undefined =>
  ROLES.includes(value as Role) ? (value as Role) : undefined;

/**
 * A Clerk user reaches us in two different shapes, and they are not the same:
 * webhook payloads are raw snake_case JSON, while clerkClient.users.getUser()
 * returns camelCase SDK resources. Accept both rather than assuming either.
 */
export interface ClerkUserLike {
  id: string;
  primary_email_address_id?: string | null;
  primaryEmailAddressId?: string | null;
  email_addresses?: { id: string; email_address: string }[];
  emailAddresses?: { id: string; emailAddress: string }[];
  first_name?: string | null;
  firstName?: string | null;
  last_name?: string | null;
  lastName?: string | null;
  public_metadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
  unsafe_metadata?: Record<string, unknown> | null;
  unsafeMetadata?: Record<string, unknown> | null;
}

/** Flattens either shape into one set of fields. */
const normalise = (u: ClerkUserLike) => ({
  id: u.id,
  primaryEmailId: u.primary_email_address_id ?? u.primaryEmailAddressId ?? null,
  emails: (u.email_addresses ?? []).map((e) => ({ id: e.id, email: e.email_address })).concat(
    (u.emailAddresses ?? []).map((e) => ({ id: e.id, email: e.emailAddress }))
  ),
  firstName: u.first_name ?? u.firstName ?? null,
  lastName: u.last_name ?? u.lastName ?? null,
  publicMetadata: u.public_metadata ?? u.publicMetadata ?? null,
  unsafeMetadata: u.unsafe_metadata ?? u.unsafeMetadata ?? null,
});

const primaryEmail = (u: ClerkUserLike): string | undefined => {
  const { emails, primaryEmailId } = normalise(u);
  return (emails.find((e) => e.id === primaryEmailId) ?? emails[0])?.email;
};

// name is NOT NULL, so fall back to the email local part for nameless Clerk users.
const displayName = (u: ClerkUserLike, email: string): string => {
  const { firstName, lastName } = normalise(u);
  return [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
};

/**
 * Clerk owns the credentials for these accounts, but password_hash is NOT NULL.
 * This sentinel is not a valid scrypt hash, so verifyPassword can never match it.
 */
const CLERK_MANAGED = 'clerk-managed';

/** Idempotent: webhooks retry and can arrive out of order, so this must be safe to replay. */
export const syncClerkUser = async (clerkUser: ClerkUserLike, requestId?: string): Promise<User> => {
  const email = primaryEmail(clerkUser);
  if (!email) throw Object.assign(new Error('Clerk user has no email address'), { status: 422 });

  // Signup writes the chosen role to unsafeMetadata (the only metadata a
  // browser may set). Trust it only to seed publicMetadata on first sync;
  // publicMetadata is what the session token's role claim reads from.
  const { publicMetadata, unsafeMetadata } = normalise(clerkUser);
  const role = toRole(publicMetadata?.role) ?? toRole(unsafeMetadata?.role);
  const data: Prisma.UserUpsertArgs['create'] = {
    clerkId: clerkUser.id,
    email,
    name: displayName(clerkUser, email),
    passwordHash: CLERK_MANAGED,
    ...(role ? { role } : {}),
  };

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    create: data,
    update: { email: data.email, name: data.name, ...(role ? { role } : {}) },
  });

  if (role && !toRole(publicMetadata?.role)) {
    await promoteRoleToPublicMetadata(clerkUser.id, role);
  }

  await audit(user.id, 'user.synced', requestId);
  return user;
};

/**
 * Soft delete: BSFI audit trails must survive the account, so we anonymise the
 * row instead of dropping it and losing every audit_logs.user_id reference.
 */
export const deleteClerkUser = async (clerkId: string, requestId?: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return; // already gone; deletion webhooks are replayable too

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: `deleted+${user.id}@invalid`,
      name: 'Deleted user',
      clerkId: null,
      isActive: false,
    },
  });
  await audit(user.id, 'user.deleted', requestId);
};

const audit = (userId: string, action: string, requestId?: string) =>
  writeAudit({ userId, action, resourceType: 'user', resourceId: userId, requestId });

/** Mirrors the role into publicMetadata so it lands in the session token claims. */
const promoteRoleToPublicMetadata = async (clerkId: string, role: Role): Promise<void> => {
  try {
    await clerkClient.users.updateUserMetadata(clerkId, { publicMetadata: { role } });
  } catch (err) {
    // The database row is already correct; a failed mirror shouldn't fail the
    // webhook and trigger a Clerk retry storm.
    console.error('[users] could not mirror role to Clerk publicMetadata', err);
  }
};
