import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Footer } from '@/components/layout/Footer';

const highlights = [
  { title: 'Mandatory training', body: 'Assign AML, KYC, and InfoSec courses with deadlines.' },
  { title: 'Audit ready', body: 'Every action lands in an immutable, exportable audit trail.' },
  { title: 'Role based', body: 'Separate views for admins, instructors, and learners.' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-24 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">BFSI LMS</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Compliance training your regulator can audit
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Deliver mandatory training, track completion, and keep an immutable record of who did
            what and when.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
