import { redirect } from 'next/navigation';
import { dashboardPathFor, getRole } from '@/lib/auth';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

export default async function AuditLogsPage() {
  const role = await getRole();
  if (role !== 'admin') redirect(dashboardPathFor(role));

  return <AuditLogViewer />;
}
