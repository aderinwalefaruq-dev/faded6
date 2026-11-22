import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/common/BrandMark';
import { useAuth } from '@/contexts/AuthContext';

export function PublicHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
        <Link to="/" className="shrink-0" aria-label="Faded6 home">
          <Wordmark />
        </Link>

        <div className="flex-1" />

        {!loading &&
          (user ? (
            <Button asChild size="sm" className="shrink-0">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden shrink-0 md:inline-flex"
              >
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="shrink-0">
                <Link to="/login?mode=signup">Start selling</Link>
              </Button>
            </>
          ))}
      </div>
    </header>
  );
}
