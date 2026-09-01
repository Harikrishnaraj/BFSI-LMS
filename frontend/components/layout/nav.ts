import {
  Award,
  BookOpen,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Role } from '@/types';

/*
 * Kept out of Sidebar.tsx on purpose: a file that exports both a component and
 * a plain value breaks Fast Refresh for everything importing it, which shows up
 * as full page reloads and a briefly unhydrated app in development.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Shared by the desktop sidebar and the mobile menu, so they can't drift apart.
export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/audit-logs', label: 'Audit logs', icon: ShieldCheck },
    { href: '/admin/compliance', label: 'Compliance reports', icon: FileBarChart },
  ],
  instructor: [
    { href: '/instructor', label: 'Instructor Dashboard', icon: LayoutDashboard },
    { href: '/instructor/courses', label: 'My courses', icon: BookOpen },
  ],
  learner: [
    { href: '/learner', label: 'My Learning', icon: LayoutDashboard },
    { href: '/learner/courses', label: 'Browse courses', icon: ClipboardList },
    { href: '/learner/certificates', label: 'Certificates', icon: Award },
  ],
};
