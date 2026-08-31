import { redirect } from 'next/navigation';
import { dashboardPathFor, getDisplayName, getRole } from '@/lib/auth';
import { LearnerDashboard } from '@/components/learner/LearnerDashboard';

export default async function LearnerPage() {
  const role = await getRole();
  // Don't render another role's view just because the URL was typed by hand.
  if (role !== 'learner') redirect(dashboardPathFor(role));

  return <LearnerDashboard name={await getDisplayName()} />;
}
