import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { getDisplayName, getRole } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  // Belt and braces: middleware.ts already gates these routes, but a layout
  // that renders user data should never assume that ran.
  if (!userId) redirect('/login');

  const [role, name] = await Promise.all([getRole(), getDisplayName()]);

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
