import { cache } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import type { Role, User } from '@/types';
import { apiFetch } from './api';

const isRole = (value: unknown): value is Role =>
  value === 'admin' || value === 'instructor' || value === 'learner';

/**
 * Role resolution, in order of preference:
 *
 * 1. The session token's `role` claim — free, no round trip. Configure it in
 *    Clerk → Sessions → Customize session token:
 *      { "role": "{{user.public_metadata.role}}" }
 * 2. The API's view of the user, which reads the stored role. This covers the
 *    window before the claim is configured, and the gap between signing up and
 *    the token refreshing with the promoted role.
 * 3. 'learner', the least-privileged role.
 *
 * Without step 2 a correctly-provisioned instructor gets bounced to the learner
 * dashboard by these page guards, while the API happily treats them as an
 * instructor — the two halves disagreeing about who you are.
 */
export const getRole = async (): Promise<Role> => {
  const { sessionClaims } = await auth();
  const claim = (sessionClaims as { role?: unknown } | null)?.role;
  if (isRole(claim)) return claim;

  const user = await getCurrentUser();
  return isRole(user?.role) ? user.role : 'learner';
};

export const getDisplayName = async (): Promise<string> => {
  const user = await currentUser();
  return (
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'there'
  );
};

/**
 * Fetches the synced user row from the Express API, provisioning it on first
 * call. Wrapped in React's cache so the layout and its page guards share one
 * round trip per request rather than one each.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { getToken, userId } = await auth();
  if (!userId) return null;

  try {
    return await apiFetch<User>('/api/auth/me', { token: await getToken() });
  } catch (err) {
    // The API being down shouldn't blank the whole dashboard shell, but a
    // failure here means the user was never provisioned — don't swallow it
    // silently, or the symptom is an empty dashboard with no explanation.
    console.error('[auth] /api/auth/me failed:', (err as Error).message);
    return null;
  }
});

export const dashboardPathFor = (role: Role): string => `/${role}`;
