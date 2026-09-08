import Link from 'next/link';
import { Button } from '@/components/ui/button';

/*
 * Without this, Next serves its own unstyled 404: black page, no branding, no
 * way back. It sits at the app root rather than inside (dashboard) so it also
 * covers signed-out visitors, where a sidebar could not render anyway.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">404</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">This page does not exist</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The link may be out of date, or the course or record it pointed to may have been removed.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Button asChild>
          <Link href="/dashboard">Back to my dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
