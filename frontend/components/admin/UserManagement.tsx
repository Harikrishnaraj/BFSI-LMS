'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common/PageHeader';
import { UserTable } from './UserTable';
import { UserFormModal, type UserFormValues } from './UserFormModal';
import { CreateUserForm } from './CreateUserForm';
import { useAdminApi } from '@/lib/admin-api';
import { ROLES, type Role } from '@/types';
import type { AdminUser } from '@/types/admin';

const PAGE_SIZE = 20;

export function UserManagement() {
  const api = useAdminApi();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [department, setDepartment] = useState('');
  const [activeOnly, setActiveOnly] = useState<'' | 'true' | 'false'>('');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const filters = {
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    role: role || undefined,
    department: department || undefined,
    isActive: activeOnly || undefined,
  };

  const users = useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => api.listUsers(filters),
    // Keeps the previous page visible while the next one loads.
    placeholderData: (prev) => prev,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) =>
      api.updateUser(id, {
        name: values.name,
        department: values.department || null,
        isActive: values.isActive,
        role: values.role,
      }),
    onSuccess: (user) => {
      invalidate();
      setEditing(null);
      toast.success(`Saved ${user.email}`);
    },
    onError: (err: Error) => toast.error('Could not save user', { description: err.message }),
  });

  const toggleActive = useMutation({
    mutationFn: (user: AdminUser) =>
      user.isActive
        ? api.deactivateUser(user.id)
        : api.updateUser(user.id, { isActive: true }),
    onSuccess: (user) => {
      invalidate();
      toast.success(user.isActive ? `Activated ${user.email}` : `Deactivated ${user.email}`);
    },
    onError: (err: Error) => toast.error('Could not change status', { description: err.message }),
  });

  const onToggleActive = (user: AdminUser) => {
    if (user.isActive && !window.confirm(`Deactivate ${user.email}? They will lose access.`)) return;
    toggleActive.mutate(user);
  };

  const total = users.data?.total ?? 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="User Management" description={`${total} users`} />
        <Button onClick={() => setCreating(true)}>Create New User</Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Name or email"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-role">Role</Label>
          <select
            id="filter-role"
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value as Role | '');
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-department">Department</Label>
          <Input
            id="filter-department"
            value={department}
            onChange={(e) => {
              setPage(1);
              setDepartment(e.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-status">Status</Label>
          <select
            id="filter-status"
            value={activeOnly}
            onChange={(e) => {
              setPage(1);
              setActiveOnly(e.target.value as '' | 'true' | 'false');
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {users.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not load users. {(users.error as Error).message}
        </p>
      )}

      <UserTable
        data={users.data?.data ?? []}
        loading={users.isPending}
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        onPageChange={setPage}
        onEdit={setEditing}
        onToggleActive={onToggleActive}
      />

      <CreateUserForm open={creating} onClose={() => setCreating(false)} />

      <UserFormModal
        open={editing !== null}
        user={editing}
        submitting={update.isPending}
        onClose={() => setEditing(null)}
        onSubmit={(values) => editing && update.mutate({ id: editing.id, values })}
      />
    </>
  );
}
