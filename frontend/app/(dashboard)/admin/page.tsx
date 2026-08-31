import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardPathFor, getRole } from '@/lib/auth';

export default async function AdminPage() {
  const role = await getRole();
  // Don't render another role's view just because the URL was typed by hand.
  if (role !== 'admin') redirect(dashboardPathFor(role));

  return (
    <>
      <PageHeader title="Admin overview" description="Users, courses, and the compliance audit trail." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nothing here yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Scaffold only — the admin views land with the feature work.
        </CardContent>
      </Card>
    </>
  );
}
