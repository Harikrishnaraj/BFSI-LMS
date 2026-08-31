import { redirect } from 'next/navigation';
import { dashboardPathFor, getRole } from '@/lib/auth';

/** /dashboard is a router: send everyone to the view their role owns. */
export default async function DashboardIndex() {
  redirect(dashboardPathFor(await getRole()));
}
