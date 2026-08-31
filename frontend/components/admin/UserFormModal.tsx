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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ROLES, type Role } from '@/types';
import type { AdminUser } from '@/types/admin';

export interface UserFormValues {
  email: string;
  name: string;
  role: Role;
  department: string;
  isActive: boolean;
}

interface UserFormModalProps {
  open: boolean;
  user: AdminUser | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(values: UserFormValues): Partial<Record<keyof UserFormValues, string>> {
  const errors: Partial<Record<keyof UserFormValues, string>> = {};
  if (!values.email.trim()) errors.email = 'Email is required';
  else if (!EMAIL.test(values.email)) errors.email = 'Enter a valid email address';
  if (!values.name.trim()) errors.name = 'Name is required';
  if (!ROLES.includes(values.role)) errors.role = 'Role is required';
  return errors;
}

const empty: UserFormValues = {
  email: '',
  name: '',
  role: 'learner',
  department: '',
  isActive: true,
};

export function UserFormModal({ open, user, submitting, onClose, onSubmit }: UserFormModalProps) {
  const [values, setValues] = useState<UserFormValues>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormValues, string>>>({});

  useEffect(() => {
    setValues(
      user
        ? {
            email: user.email,
            name: user.name,
            role: user.role,
            department: user.department ?? '',
            isActive: user.isActive,
          }
        : empty
    );
    setErrors({});
  }, [user, open]);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  };

  const editing = user !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit user' : 'Create user'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Email cannot be changed after creation.' : 'The user receives a temporary password.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email} htmlFor="email">
            <Input
              id="email"
              type="email"
              value={values.email}
              readOnly={editing}
              disabled={editing}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>

          <Field label="Name" error={errors.name} htmlFor="name">
            <Input id="name" value={values.name} onChange={(e) => set('name', e.target.value)} />
          </Field>

          <Field label="Role" error={errors.role} htmlFor="role">
            <select
              id="role"
              value={values.role}
              onChange={(e) => set('role', e.target.value as Role)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Department (optional)" htmlFor="department">
            <Input
              id="department"
              value={values.department}
              onChange={(e) => set('department', e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="isActive">Active</Label>
            <Switch
              id="isActive"
              checked={values.isActive}
              onCheckedChange={(checked) => set('isActive', checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
