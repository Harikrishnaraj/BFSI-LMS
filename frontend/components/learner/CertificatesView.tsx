'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { CertificateCard } from './CertificateCard';
import { useLearnerApi } from '@/lib/learner-api';
import { cn } from '@/lib/utils';
import type { CertificateState } from '@/types/admin';

const TABS: { value: '' | CertificateState; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
];

export function CertificatesView() {
  const api = useLearnerApi();
  const [tab, setTab] = useState<'' | CertificateState>('');

  const certificates = useQuery({
    queryKey: ['learner', 'certificates'],
    queryFn: api.certificates,
  });

  const visible = (certificates.data?.data ?? []).filter((c) => !tab || c.state === tab);

  return (
    <>
      <PageHeader title="My Certificates" description="Proof of completed training." />

      <div className="mb-6 flex gap-2 border-b" role="tablist">
        {TABS.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm',
              tab === option.value
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {certificates.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not load certificates. {(certificates.error as Error).message}
        </p>
      )}

      {certificates.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t earned any certificates yet. Complete a course to get started!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} />
          ))}
        </div>
      )}
    </>
  );
}
