import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardPathFor, getRole } from '@/lib/auth';

export default async function InstructorPage() {
  const role = await getRole();
  // Don't render another role's view just because the URL was typed by hand.
  if (role !== 'instructor') redirect(dashboardPathFor(role));

  return (
    <>
      <PageHeader title="Instructor overview" description="Courses you own and learner progress." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nothing here yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Scaffold only — the instructor views land with the feature work.
        </CardContent>
      </Card>
    </>
  );
}
