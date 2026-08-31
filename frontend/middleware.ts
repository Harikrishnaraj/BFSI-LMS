import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/forgot-password(.*)',
]);

const isDashboardRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/admin(.*)',
  '/instructor(.*)',
  '/learner(.*)',
]);

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  instructor: '/instructor',
  learner: '/learner',
};

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();
  if (!isDashboardRoute(req)) return NextResponse.next();

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  // Least privilege when the role claim is missing or unrecognised.
  const claim = (sessionClaims as { role?: string } | null)?.role;
  const home = ROLE_HOME[claim ?? ''] ?? '/learner';

  // /dashboard is a router; send it to the role's own section.
  if (req.nextUrl.pathname === '/dashboard') {
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)'],
};
