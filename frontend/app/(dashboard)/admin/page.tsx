import { redirect } from 'next/navigation';
import { dashboardPathFor, getDisplayName, getRole } from '@/lib/auth';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default async function AdminPage() {
  const role = await getRole();
  // Don't render another role's view just because the URL was typed by hand.
  if (role !== 'admin') redirect(dashboardPathFor(role));

  return <AdminDashboard name={await getDisplayName()} />;
}
