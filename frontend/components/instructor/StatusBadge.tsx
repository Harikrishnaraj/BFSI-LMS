import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CourseStatus } from '@/types/admin';

const STYLES: Record<CourseStatus, string> = {
  draft: 'text-muted-foreground',
  published: 'text-success',
  archived: 'text-muted-foreground line-through',
};

export function StatusBadge({ status }: { status: CourseStatus }) {
  return (
    <Badge variant="outline" className={cn('uppercase', STYLES[status])}>
      {status}
    </Badge>
  );
}
