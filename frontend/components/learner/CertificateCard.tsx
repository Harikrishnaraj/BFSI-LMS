'use client';

import { Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CertificateState, LearnerCertificate } from '@/types/admin';

const STATE: Record<CertificateState, { label: string; className: string }> = {
  active: { label: 'Active ✅', className: 'text-success' },
  expiring_soon: { label: 'Expiring Soon ⚠️', className: 'text-warning' },
  expired: { label: 'Expired ❌', className: 'text-destructive' },
};

export function CertificateCard({ certificate }: { certificate: LearnerCertificate }) {
  const state = STATE[certificate.state];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-accent p-2 text-accent-foreground" aria-hidden>
            <Award className="h-5 w-5" />
          </span>
          <CardTitle className="text-base">{certificate.course.title}</CardTitle>
        </div>
        <Badge variant="outline" className={cn('shrink-0', state.className)}>
          {state.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{new Date(certificate.issued_at).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Expires</dt>
            <dd>
              {certificate.expires_at
                ? new Date(certificate.expires_at).toLocaleDateString()
                : 'No expiry'}
            </dd>
          </div>
        </dl>

        {/* ponytail: no PDF renderer yet, so there is nothing to hand over.
            Disabled rather than offering a download that would 404. */}
        <Button variant="outline" size="sm" disabled title="PDF generation is not implemented yet">
          Download Certificate
        </Button>
      </CardContent>
    </Card>
  );
}
