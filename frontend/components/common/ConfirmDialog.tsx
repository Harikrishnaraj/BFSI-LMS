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

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Consequences of confirming, shown below the question. */
  detail?: string;
  confirmLabel: string;
  pendingLabel: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** The styled stand-in for window.confirm — every destructive action uses it. */
export function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  pendingLabel,
  submitting,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={submitting}>
            {submitting ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
