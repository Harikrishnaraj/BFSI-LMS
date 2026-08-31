'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ContentType } from '@/types/admin';

const TYPES: { value: ContentType; label: string; hint: string }[] = [
  { value: 'video', label: 'Video', hint: 'Link to an uploaded video file' },
  { value: 'pdf', label: 'PDF', hint: 'Link to an uploaded PDF' },
  { value: 'richtext', label: 'Rich Text', hint: 'Written directly in the editor' },
  { value: 'scorm', label: 'SCORM', hint: 'Packaged course; player lands in phase 4' },
];

interface AddContentModalProps {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    contentType: ContentType;
    title: string;
    description: string;
    fileUrl: string;
    contentText: string;
  }) => void;
}

export function AddContentModal({ open, submitting, onClose, onSubmit }: AddContentModalProps) {
  const [contentType, setContentType] = useState<ContentType>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [contentText, setContentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isText = contentType === 'richtext';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return setError('Title is required');
    if (isText && !contentText.trim()) return setError('Add some text for this item');
    if (!isText && !fileUrl.trim()) return setError('A file URL is required');

    setError(null);
    onSubmit({ contentType, title: title.trim(), description, fileUrl, contentText });
    setTitle('');
    setDescription('');
    setFileUrl('');
    setContentText('');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add content</DialogTitle>
          <DialogDescription>
            {/* ponytail: URL field, not an uploader — direct upload needs object
                storage and signed URLs, which is its own piece of work. */}
            Files are referenced by URL for now; uploads arrive with storage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Content type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`cursor-pointer rounded-md border p-3 text-sm ${
                    contentType === type.value ? 'border-primary bg-accent' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="contentType"
                      value={type.value}
                      checked={contentType === type.value}
                      onChange={() => setContentType(type.value)}
                    />
                    {type.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{type.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="content-title">Title</Label>
            <Input id="content-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-description">Description</Label>
            <Input
              id="content-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {isText ? (
            <div className="space-y-2">
              <Label htmlFor="content-text">Content</Label>
              <Textarea
                id="content-text"
                rows={8}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content-url">File URL</Label>
              <Input
                id="content-url"
                type="url"
                placeholder="https://storage.example.com/module.mp4"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
              {contentType === 'video' && fileUrl && (
                <video src={fileUrl} controls className="mt-2 w-full rounded-md border" />
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Content'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
