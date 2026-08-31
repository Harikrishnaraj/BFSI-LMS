'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AuditLogEntry } from '@/types/admin';

export function AuditLogDetail({
  entry,
  onClose,
}: {
  entry: AuditLogEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {entry.action}
                <Badge
                  variant="outline"
                  className={cn(entry.status === 'success' ? 'text-success' : 'text-destructive')}
                >
                  {entry.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {/* UTC, because the trail is read across regions during an audit. */}
                {new Date(entry.timestamp).toISOString()} (UTC)
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="User email" value={entry.user_email} />
              <Row label="User ID" value={entry.user_id} />
              <Row label="Resource type" value={entry.resource_type} />
              <Row label="Resource ID" value={entry.resource_id} />
              <Row label="IP address" value={entry.ip_address} />
              <Row label="Request ID" value={entry.request_id} />
              <Row label="User agent" value={entry.user_agent} className="sm:col-span-2" />
              {entry.error_message && (
                <Row label="Error" value={entry.error_message} className="sm:col-span-2 text-destructive" />
              )}
            </dl>

            {entry.details != null && (
              <div>
                <p className="mb-2 text-sm font-medium">Details</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value ?? '—'}</dd>
    </div>
  );
}
