'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common/PageHeader';
import { AuditLogTable } from './AuditLogTable';
import { AuditLogDetail } from './AuditLogDetail';
import { useAdminApi } from '@/lib/admin-api';
import { plural } from '@/lib/utils';
import type { AuditLogEntry } from '@/types/admin';

const PAGE_SIZE = 50;
const REFRESH_MS = 30_000;

// Extend as new audit actions are added server-side.
const ACTIONS = [
  'login',
  'user.synced',
  'user.deleted',
  'admin.user.create',
  'admin.user.update',
  'admin.user.deactivate',
  'admin.audit.export',
];

interface Filters {
  userId: string;
  action: string;
  result: '' | 'success' | 'failure';
  startDate: string;
  endDate: string;
}

const emptyFilters: Filters = { userId: '', action: '', result: '', startDate: '', endDate: '' };

export function AuditLogViewer() {
  const api = useAdminApi();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const query = {
    page,
    limit: PAGE_SIZE,
    userId: applied.userId || undefined,
    action: applied.action || undefined,
    result: applied.result || undefined,
    // Dates arrive as yyyy-mm-dd; widen to cover the whole end day.
    startDate: applied.startDate ? `${applied.startDate}T00:00:00Z` : undefined,
    endDate: applied.endDate ? `${applied.endDate}T23:59:59Z` : undefined,
  };

  const logs = useQuery({
    queryKey: ['admin', 'audit-logs', query],
    queryFn: () => api.listAuditLogs(query),
    refetchInterval: REFRESH_MS,
    placeholderData: (prev) => prev,
  });

  const exportCsv = useMutation({
    mutationFn: () =>
      api.exportAuditLogs({
        startDate: query.startDate,
        endDate: query.endDate,
        format: 'csv',
      }),
    onSuccess: (report) => {
      toast.success(`Report ready (${report.rows} rows)`, {
        action: {
          label: 'Download',
          onClick: () =>
            api
              .downloadReport(report.downloadUrl, `audit-log-${report.reportId}.csv`)
              .catch((err: Error) => toast.error('Download failed', { description: err.message })),
        },
        duration: 15000,
      });
    },
    onError: (err: Error) => toast.error('Export failed', { description: err.message }),
  });

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((f) => ({ ...f, [key]: value }));

  const total = logs.data?.total ?? 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Audit Logs"
          description={`${plural(total, 'entry', 'entries')} · refreshes every 30s`}
        />
        <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
          {exportCsv.isPending ? 'Generating…' : 'Export to CSV'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-md border p-4">
          <p className="font-medium">Filters</p>

          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={draft.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user">User ID</Label>
            <Input id="user" value={draft.userId} onChange={(e) => set('userId', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <select
              id="action"
              value={draft.action}
              onChange={(e) => set('action', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="result">Result</Label>
            <select
              id="result"
              value={draft.result}
              onChange={(e) => set('result', e.target.value as Filters['result'])}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setPage(1);
                setApplied(draft);
              }}
            >
              Apply Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(emptyFilters);
                setApplied(emptyFilters);
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        </aside>

        <div>
          {logs.isError && (
            <p className="mb-4 text-sm text-destructive">
              Could not load audit logs. {(logs.error as Error).message}
            </p>
          )}
          {logs.isFetching && !logs.isPending && (
            <p className="mb-2 text-xs text-muted-foreground">Refreshing…</p>
          )}
          <AuditLogTable
            data={logs.data?.data ?? []}
            loading={logs.isPending}
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            onPageChange={setPage}
            onSelect={setSelected}
          />
        </div>
      </div>

      <AuditLogDetail entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
