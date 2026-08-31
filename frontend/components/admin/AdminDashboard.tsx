'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from './MetricCard';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceChart } from './ComplianceChart';
import { useAdminApi } from '@/lib/admin-api';

const FIVE_MINUTES = 5 * 60 * 1000;

export function AdminDashboard({ name }: { name: string }) {
  const api = useAdminApi();

  const metrics = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: api.metrics,
    // Backend caches for 5 minutes, so polling faster just burns requests.
    refetchInterval: FIVE_MINUTES,
    staleTime: FIVE_MINUTES,
  });

  const compliance = useQuery({
    queryKey: ['admin', 'compliance'],
    queryFn: api.compliance,
    refetchInterval: FIVE_MINUTES,
  });

  const loading = metrics.isPending;
  const data = metrics.data;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome, {name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/compliance">Generate Compliance Report</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/audit-logs">View Audit Logs</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">Manage Users</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/settings">System Settings</Link>
          </Button>
        </div>
      </div>

      {metrics.isError && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load dashboard metrics. {(metrics.error as Error).message}
            <Button variant="outline" size="sm" className="ml-4" onClick={() => metrics.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Users" value={data?.totalUsers ?? '—'} icon={Users} loading={loading} />
        <MetricCard title="Active Courses" value={data?.activeCourses ?? '—'} icon={BookOpen} loading={loading} />
        <MetricCard
          title="Compliance Rate"
          value={data ? `${(data.completionRate * 100).toFixed(0)}%` : '—'}
          icon={ShieldCheck}
          loading={loading}
        />
        <MetricCard
          title="Certificates Expiring"
          value={data?.certificatesExpiringSoon ?? '—'}
          icon={Award}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Mandatory course compliance</CardTitle>
          </CardHeader>
          <CardContent>
            {compliance.isPending ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : compliance.isError ? (
              <p className="text-sm text-destructive">Could not load course compliance.</p>
            ) : (
              <ComplianceTable data={compliance.data?.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : data ? (
              <ComplianceChart status={data.complianceStatus} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {data && (
        <p className="mt-6 text-xs text-muted-foreground">
          Last updated {new Date(data.lastUpdate).toLocaleString()}
        </p>
      )}
    </>
  );
}
