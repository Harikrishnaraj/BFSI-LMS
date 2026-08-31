import { auth, currentUser } from '@clerk/nextjs/server';
import type { Role, User } from '@/types';
import { apiFetch } from './api';

const isRole = (value: unknown): value is Role =>
  value === 'admin' || value === 'instructor' || value === 'learner';

/**
 * Role comes from the Clerk session token's custom claims. Configure it in
 * Clerk → Sessions → Customize session token as: { "role": "{{user.public_metadata.role}}" }
 * Falls back to 'learner', the least-privileged role, when the claim is absent.
 */
export const getRole = async (): Promise<Role> => {
  const { sessionClaims } = await auth();
  const claim = (sessionClaims as { role?: unknown } | null)?.role;
  return isRole(claim) ? claim : 'learner';
};

export const getDisplayName = async (): Promise<string> => {
  const user = await currentUser();
  return (
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'there'
  );
};

/** Fetches the synced user row from the Express API using the caller's session token. */
export const getCurrentUser = async (): Promise<User | null> => {
  const { getToken, userId } = await auth();
  if (!userId) return null;

  try {
    return await apiFetch<User>('/api/auth/me', { token: await getToken() });
  } catch {
    // The API being down shouldn't blank the whole dashboard shell.
    return null;
  }
};

export const dashboardPathFor = (role: Role): string => `/${role}`;
