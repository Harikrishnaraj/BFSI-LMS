'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardMetrics } from '@/types/admin';

// Fixed semantic colours: these three always mean the same thing in both themes.
const SLICES = [
  { key: 'compliant', label: 'Compliant', color: '#16A34A' },
  { key: 'atRisk', label: 'At risk', color: '#F59E0B' },
  { key: 'nonCompliant', label: 'Non-compliant', color: '#DC2626' },
] as const;

export function ComplianceChart({ status }: { status: DashboardMetrics['complianceStatus'] }) {
  const data = SLICES.map((slice) => ({
    name: slice.label,
    value: status[slice.key],
    color: slice.color,
  }));

  if (data.every((d) => d.value === 0)) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No compliance data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            color: 'hsl(var(--popover-foreground))',
          }}
        />
        <Legend verticalAlign="bottom" height={32} />
      </PieChart>
    </ResponsiveContainer>
  );
}
