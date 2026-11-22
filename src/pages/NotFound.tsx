import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '@/components/layout/PublicHeader';

export default function NotFound() {
  return (
    <>
      <PageMeta
        title="Page not found — Faded6"
        description="The page you are looking for does not exist."
      />
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-electric">
            <Compass className="h-7 w-7" />
          </span>
          <p className="mt-5 font-display text-4xl font-semibold text-electric">404</p>
          <h1 className="mt-2 font-display text-xl font-semibold text-balance">
            This page has left the venue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            The link may be broken, or the event was removed. Check the URL and try again.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2 md:flex-row md:justify-center">
            <Button asChild className="w-full md:w-auto">
              <Link to="/">Back to home</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full md:w-auto">
              <Link to="/dashboard">Host dashboard</Link>
            </Button>
          </div>
        </main>
      </div>
    </>
  );
}
