import { UserButton } from '@clerk/nextjs';
import { MobileNav } from './MobileNav';
import type { Role } from '@/types';

export function Header({ name, role }: { name: string; role: Role }) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Only rendered below md, where the sidebar is hidden. */}
        <MobileNav role={role} />

        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="truncate font-medium">
            {name} <span className="text-muted-foreground">· {role}</span>
          </p>
        </div>
      </div>

      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
