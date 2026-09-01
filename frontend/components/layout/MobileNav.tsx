'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAV } from './nav';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

/**
 * The sidebar is desktop-only, which left phones with no navigation at all.
 * This is the same NAV list behind a hamburger, shown only below the md
 * breakpoint where the sidebar disappears.
 */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating should dismiss the menu; without this it stays over the page
  // the user just asked for.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // Don't let the page behind scroll while the overlay is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="rounded-md p-2 hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          <nav
            id="mobile-nav"
            className="relative flex h-full w-72 max-w-[80%] flex-col bg-sidebar text-sidebar-foreground"
          >
            <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-4">
              <div>
                <Link href="/" className="text-lg font-semibold">
                  BFSI LMS
                </Link>
                <p className="mt-1 text-xs uppercase tracking-wide opacity-70">{role}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="flex-1 space-y-1 p-4">
              {NAV[role].map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      // Close immediately rather than waiting for the route to
                      // resolve: a server-rendered page can take a second or
                      // two, and the menu sitting over it looks like a hang.
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
