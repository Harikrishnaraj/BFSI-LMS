'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAdminApi } from '@/lib/admin-api';

const REPORT_TYPES = [
  { value: 'audit-trail', label: 'Audit Trail Report' },
  { value: 'training-completion', label: 'Training Completion Report' },
  { value: 'certification', label: 'Certification Report' },
] as const;

// Only CSV is implemented server-side; the others are disabled rather than
// offered and then failing at submit time.
const FORMATS = [
  { value: 'csv', label: 'CSV', enabled: true },
  { value: 'pdf', label: 'PDF', enabled: false },
  { value: 'xlsx', label: 'Excel', enabled: false },
] as const;

interface GeneratedReport {
  reportId: string;
  downloadUrl: string;
  generatedAt: string;
  rows: number;
  type: string;
}

export function ComplianceReportGenerator() {
  const api = useAdminApi();

  const [type, setType] = useState<string>('audit-trail');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState('csv');
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<GeneratedReport[]>([]);

  const generate = useMutation({
    mutationFn: () =>
      api.exportAuditLogs({
        startDate: startDate ? startDate + 'T00:00:00Z' : undefined,
        endDate: endDate ? endDate + 'T23:59:59Z' : undefined,
        format,
      }),
    onSuccess: (report) => {
      const entry = { ...report, type };
      setReports((prev) => [entry, ...prev]);
      toast.success('Report ready (' + report.rows + ' rows)');
      download(entry);
    },
    onError: (err: Error) => toast.error('Could not generate report', { description: err.message }),
  });

  const download = (report: GeneratedReport) =>
    api
      .downloadReport(report.downloadUrl, `${report.type}-${report.reportId}.csv`)
      .catch((err: Error) => toast.error('Download failed', { description: err.message }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      setError('The start date must be before the end date.');
      return;
    }
    setError(null);
    generate.mutate();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Report type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">From</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">To</Label>
                <Input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Export format</legend>
              <div className="flex gap-4">
                {FORMATS.map((f) => (
                  <label
                    key={f.value}
                    className={cn('flex items-center gap-2 text-sm', !f.enabled && 'text-muted-foreground')}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={f.value}
                      checked={format === f.value}
                      disabled={!f.enabled}
                      onChange={(e) => setFormat(e.target.value)}
                    />
                    {f.label}
                    {!f.enabled && ' (soon)'}
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {generate.isPending && (
              <div className="h-1 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
              </div>
            )}

            <Button type="submit" disabled={generate.isPending}>
              {generate.isPending ? 'Generating…' : 'Generate Report'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reports generated this session</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing generated yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Generated</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.reportId}>
                    <TableCell className="text-muted-foreground">
                      {new Date(report.generatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{report.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{report.rows}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => download(report)}>
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
