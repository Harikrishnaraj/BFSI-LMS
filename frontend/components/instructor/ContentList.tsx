'use client';

import { ArrowDown, ArrowUp, FileText, Film, Package, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ContentType, CourseContentItem } from '@/types/admin';

const ICONS: Record<ContentType, React.ComponentType<{ className?: string }>> = {
  video: Film,
  pdf: FileText,
  richtext: Type,
  scorm: Package,
};

const LABELS: Record<ContentType, string> = {
  video: 'Video',
  pdf: 'PDF',
  richtext: 'Text',
  scorm: 'SCORM',
};

interface ContentListProps {
  items: CourseContentItem[];
  editable: boolean;
  busy?: boolean;
  onAdd: () => void;
  onDelete: (item: CourseContentItem) => void;
  onReorder: (order: string[]) => void;
}

export function ContentList({
  items,
  editable,
  busy,
  onAdd,
  onDelete,
  onReorder,
}: ContentListProps) {
  /*
   * Move up/down rather than drag and drop: it is keyboard accessible out of
   * the box and needs no dnd dependency. Swap to drag when the ordering gets
   * long enough to be painful.
   */
  const move = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((item) => item.id));
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No content yet. Click &lsquo;Add Content&rsquo; to get started.
        </p>
        {editable && (
          <Button className="mt-4" onClick={onAdd}>
            Add Content
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="divide-y rounded-md border">
        {items.map((item, index) => {
          const Icon = ICONS[item.contentType];
          return (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                {item.description && (
                  <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>

              <Badge variant="outline">{LABELS[item.contentType]}</Badge>

              {editable && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0 || busy}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${item.title} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === items.length - 1 || busy}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${item.title} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onDelete(item)}
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editable && (
        <Button variant="outline" onClick={onAdd}>
          Add Content
        </Button>
      )}
    </div>
  );
}
