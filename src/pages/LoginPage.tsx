import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BrandMark } from '@/components/common/BrandMark';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn, signUp } = useAuth();

  const mode: Mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';

  useEffect(() => {
    if (!loading && user) navigate(redirectTo, { replace: true });
  }, [user, loading, navigate, redirectTo]);

  const switchMode = (next: Mode) => {
    setError('');
    setSearchParams(next === 'signup' ? { mode: 'signup' } : {}, { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    if (mode === 'signup' && displayName.trim().length < 2) {
      setError('Tell us the name of your organisation or your own name.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !agreed) {
      setError('Please accept the User Agreement and Privacy Policy.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
          return;
        }
        toast.success('Welcome back');
        navigate(redirectTo, { replace: true });
      } else {
        const { error: signUpError, needsConfirmation } = await signUp(
          email,
          password,
          displayName,
        );
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (needsConfirmation) {
          toast.success('Check your inbox to confirm your email, then sign in.');
          switchMode('signin');
          return;
        }
        toast.success('Your host account is ready');
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <PageMeta
        title="Host sign in — Faded6"
        description="Sign in to create events, track ticket sales and scan guests in at the gate."
      />
      <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-card p-10 text-foreground md:flex">
        <div className="halftone absolute inset-0" aria-hidden="true" />
        <svg
          viewBox="0 0 400 520"
          className="pointer-events-none absolute -right-16 bottom-0 h-[78%] w-auto text-electric/25"
          fill="none"
          aria-hidden="true"
        >
          <path d="M40 520V210a160 160 0 0 1 320 0v310" stroke="currentColor" strokeWidth="2" />
          <path d="M90 520V215a110 110 0 0 1 220 0v305" stroke="currentColor" strokeWidth="1.2" />
          <path d="M140 520V220a60 60 0 0 1 120 0v300" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="200" cy="230" r="26" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="200" cy="230" r="10" fill="currentColor" opacity="0.5" />
        </svg>

        <Link to="/" className="relative flex items-center gap-2.5">
          <BrandMark className="h-8 w-8 text-electric" />
          <span className="font-display text-xl font-semibold tracking-tight">Faded6</span>
        </Link>

        <div className="relative max-w-sm">
          <div className="mb-6 h-px w-24 bg-electric/60" />
          <p className="font-display text-3xl font-semibold leading-tight text-balance">
            Every gate, every guest, accounted for.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground70">
            Publish your event in minutes, take payment in Naira, and scan guests in with the
            browser already in your pocket.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-xs uppercase tracking-[0.18em] text-muted-foreground50">
          <span>Paystack</span>
          <span>NGN</span>
          <span>QR entry</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center px-4 md:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-2 px-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-16 md:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-2.5 md:hidden">
              <BrandMark className="h-7 w-7 text-electric" />
              <span className="font-display text-lg font-semibold tracking-tight">Faded6</span>
            </div>

            <p className="text-xs uppercase tracking-[0.2em] text-electric">Host access</p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-balance md:text-3xl">
              {mode === 'signin' ? 'Sign in to your dashboard' : 'Create your host account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {mode === 'signin'
                ? 'Manage events, track sales, and open the gate scanner.'
                : 'Free to start. You only pay the flat ₦350 fee when you sell a paid ticket.'}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={cn(
                  'min-h-10 rounded-md text-sm font-medium transition-colors',
                  mode === 'signin'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={cn(
                  'min-h-10 rounded-md text-sm font-medium transition-colors',
                  mode === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              {mode === 'signup' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="displayName">Your name or organisation</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Lagos Social Club"
                    autoComplete="organization"
                    className="h-11 px-3"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-11 px-3"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="h-11 px-3"
                />
              </div>

              {mode === 'signup' && (
                <label className="flex min-h-12 items-start gap-3 rounded-lg border border-border bg-card p-3">
                  <Checkbox
                    checked={agreed}
                    onCheckedChange={(value) => setAgreed(value === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    I agree to the Faded6 User Agreement and Privacy Policy. Tickets are sold
                    under the organiser&apos;s terms.
                  </span>
                </label>
              )}

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Buying a ticket? You do not need an account — just open the event link.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
