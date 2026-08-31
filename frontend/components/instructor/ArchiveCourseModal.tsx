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

interface ArchiveCourseModalProps {
  open: boolean;
  title?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArchiveCourseModal({
  open,
  title,
  submitting,
  onClose,
  onConfirm,
}: ArchiveCourseModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive course</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive {title ? `“${title}”` : 'this course'}?
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Enrolled students will still have access, but new enrollments will be blocked.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Archiving…' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
