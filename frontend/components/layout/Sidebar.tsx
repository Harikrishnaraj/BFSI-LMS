'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from './nav';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          BFSI LMS
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wide opacity-70">{role}</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {NAV[role].map(({ href, label, icon: Icon }) => {
          // '/admin' would otherwise light up on every nested admin route.
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
