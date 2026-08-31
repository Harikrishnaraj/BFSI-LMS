import { redirect } from 'next/navigation';
import { dashboardPathFor, getRole } from '@/lib/auth';
import { UserManagement } from '@/components/admin/UserManagement';

export default async function UsersPage() {
  const role = await getRole();
  if (role !== 'admin') redirect(dashboardPathFor(role));

  return <UserManagement />;
}
