'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CourseCompliance } from '@/types/admin';

type SortKey = 'title' | 'assigned' | 'completed' | 'completionRate';

/** Green above 90%, orange 70–90%, red below 70% — thresholds from the brief. */
const band = (rate: number) =>
  rate > 0.9
    ? { label: 'On track', icon: '✅', className: 'text-success' }
    : rate >= 0.7
      ? { label: 'At risk', icon: '⚠️', className: 'text-warning' }
      : { label: 'Behind', icon: '❌', className: 'text-destructive' };

export function ComplianceTable({ data }: { data: CourseCompliance[] }) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: 'completionRate',
    asc: true,
  });

  const rows = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const [x, y] = [a[sort.key], b[sort.key]];
      const cmp = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.asc ? cmp : -cmp;
    });
    return sorted;
  }, [data, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));

  const header = (key: SortKey, label: string, className?: string) => (
    <TableHead
      className={className}
      aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => toggle(key)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <span className="text-xs">{sort.key === key ? (sort.asc ? '▲' : '▼') : ''}</span>
      </button>
    </TableHead>
  );

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No mandatory courses yet.</p>;
  }

  return (
    // Narrow screens scroll the table rather than the page.
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {header('title', 'Course')}
            {header('assigned', 'Assigned', 'text-right')}
            {header('completed', 'Completed', 'text-right')}
            {header('completionRate', 'Rate', 'text-right')}
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((course) => {
            const status = band(course.completionRate);
            return (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell className="text-right tabular-nums">{course.assigned}</TableCell>
                <TableCell className="text-right tabular-nums">{course.completed}</TableCell>
                <TableCell className={cn('text-right tabular-nums font-medium', status.className)}>
                  {(course.completionRate * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={status.className}>
                    <span aria-hidden>{status.icon}</span>
                    <span className="ml-1">{status.label}</span>
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
