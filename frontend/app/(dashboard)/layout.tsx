import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { getCurrentUser, getDisplayName, getRole } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  // Belt and braces: middleware.ts already gates these routes, but a layout
  // that renders user data should never assume that ran.
  if (!userId) redirect('/login');

  /*
   * Hitting /api/auth/me here provisions the local users row on first sign-in,
   * so the app works before the Clerk webhook is wired up (and self-heals if a
   * webhook is ever missed). The API is the authority on role — it falls back
   * to the stored role when the session claim is absent — so prefer what it
   * says and use the claim only when the API is unreachable.
   */
  const [user, claimRole, clerkName] = await Promise.all([
    getCurrentUser(),
    getRole(),
    getDisplayName(),
  ]);

  const role = user?.role ?? claimRole;
  const name = user?.name ?? clerkName;

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={name} role={role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
