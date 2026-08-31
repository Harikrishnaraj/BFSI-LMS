import { redirect } from 'next/navigation';
import { dashboardPathFor, getRole } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { ComplianceReportGenerator } from '@/components/admin/ComplianceReportGenerator';

export default async function CompliancePage() {
  const role = await getRole();
  if (role !== 'admin') redirect(dashboardPathFor(role));

  return (
    <>
      <PageHeader
        title="Compliance Reports"
        description="Generate an evidence pack for a date range."
      />
      <ComplianceReportGenerator />
    </>
  );
}
