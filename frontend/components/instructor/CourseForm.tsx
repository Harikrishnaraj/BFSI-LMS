'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from './StatusBadge';
import type { CourseSummary, Difficulty } from '@/types/admin';

export const CATEGORIES = ['Compliance', 'Risk', 'Security', 'Product', 'Onboarding'];
export const COMPLIANCE_TYPES = ['AML', 'KYC', 'Data Privacy', 'InfoSec', 'Conduct'];
export const AUDIENCES = ['Employees', 'Customers', 'Partners'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

const TITLE_MAX = 255;

export interface CourseFormValues {
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  isMandatory: boolean;
  targetAudience: string[];
  complianceType: string;
}

const empty: CourseFormValues = {
  title: '',
  description: '',
  category: CATEGORIES[0],
  difficulty: 'beginner',
  isMandatory: false,
  targetAudience: [],
  complianceType: '',
};

export function validateCourse(values: CourseFormValues) {
  const errors: Partial<Record<keyof CourseFormValues, string>> = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  else if (values.title.trim().length > TITLE_MAX)
    errors.title = `Title must be ${TITLE_MAX} characters or fewer`;
  if (!values.category.trim()) errors.category = 'Category is required';
  return errors;
}

interface CourseFormProps {
  open: boolean;
  course?: CourseSummary | null;
  submitting?: boolean;
  onClose: () => void;
  /** publish=true asks the caller to save and then run the publish flow. */
  onSubmit: (values: CourseFormValues, publish: boolean) => void;
}

export function CourseForm({ open, course, submitting, onClose, onSubmit }: CourseFormProps) {
  const [values, setValues] = useState<CourseFormValues>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof CourseFormValues, string>>>({});

  useEffect(() => {
    setValues(
      course
        ? {
            title: course.title,
            description: course.description ?? '',
            category: course.category ?? CATEGORIES[0],
            difficulty: course.difficulty,
            isMandatory: course.isMandatory,
            // Stored as a single string server-side; the form edits it as a list.
            targetAudience: course.targetAudience
              ? course.targetAudience.split(',').map((a) => a.trim()).filter(Boolean)
              : [],
            complianceType: course.complianceType ?? '',
          }
        : empty
    );
    setErrors({});
  }, [course, open]);

  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = (publish: boolean) => (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateCourse(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values, publish);
  };

  const toggleAudience = (audience: string) =>
    set(
      'targetAudience',
      values.targetAudience.includes(audience)
        ? values.targetAudience.filter((a) => a !== audience)
        : [...values.targetAudience, audience]
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit course' : 'Create course'}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {course ? (
              <>
                Status: <StatusBadge status={course.status} />
              </>
            ) : (
              'New courses start as a draft.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit(false)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="course-title">Course title</Label>
            <Input
              id="course-title"
              maxLength={TITLE_MAX}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
            />
            {errors.title && (
              <p role="alert" className="text-sm text-destructive">
                {errors.title}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-description">Description</Label>
            <Textarea
              id="course-description"
              rows={4}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="course-category">Category</Label>
              <select
                id="course-category"
                value={values.category}
                onChange={(e) => set('category', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.category}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-difficulty">Difficulty</Label>
              <select
                id="course-difficulty"
                value={values.difficulty}
                onChange={(e) => set('difficulty', e.target.value as Difficulty)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-compliance">Compliance type</Label>
            <select
              id="course-compliance"
              value={values.complianceType}
              onChange={(e) => set('complianceType', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">None</option>
              {COMPLIANCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Target audience</legend>
            <div className="flex flex-wrap gap-4">
              {AUDIENCES.map((audience) => (
                <label key={audience} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.targetAudience.includes(audience)}
                    onCheckedChange={() => toggleAudience(audience)}
                  />
                  {audience}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="course-mandatory">Mandatory course</Label>
            <Switch
              id="course-mandatory"
              checked={values.isMandatory}
              onCheckedChange={(checked) => set('isMandatory', checked)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save as Draft'}
            </Button>
            <Button type="button" onClick={submit(true)} disabled={submitting}>
              Publish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
