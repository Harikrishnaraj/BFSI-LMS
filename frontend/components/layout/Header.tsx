import { UserButton } from '@clerk/nextjs';
import type { Role } from '@/types';

export function Header({ name, role }: { name: string; role: Role }) {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div>
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-medium">
          {name} <span className="text-muted-foreground">· {role}</span>
        </p>
      </div>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
