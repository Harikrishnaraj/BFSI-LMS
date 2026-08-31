import { redirect } from 'next/navigation';
import { dashboardPathFor, getDisplayName, getRole } from '@/lib/auth';
import { InstructorDashboard } from '@/components/instructor/InstructorDashboard';

export default async function InstructorPage() {
  const role = await getRole();
  // Don't render another role's view just because the URL was typed by hand.
  if (role !== 'instructor') redirect(dashboardPathFor(role));

  return <InstructorDashboard name={await getDisplayName()} />;
}
