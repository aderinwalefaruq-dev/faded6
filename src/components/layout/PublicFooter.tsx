import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/common/BrandMark';

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-7 w-7 text-electric" />
              <span className="font-display text-lg font-semibold tracking-tight">Faded6</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground70">
              Ticketing built for Nigerian events. Naira pricing, Paystack checkout, and a gate
              scanner that works in any browser.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground50">
              Hosts
            </span>
            <Link to="/login?mode=signup" className="text-muted-foreground80 hover:text-electric">
              Create an event
            </Link>
            <Link to="/login" className="text-muted-foreground80 hover:text-electric">
              Sign in
            </Link>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground50">
              Payments
            </span>
            <span className="text-muted-foreground80">Paystack · NGN</span>
            <span className="text-muted-foreground80">5% + ₦175 service fee</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border/15 pt-6 text-xs text-muted-foreground50 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Faded6. Lagos, Nigeria.</span>
          <span>Prices in Nigerian Naira (₦).</span>
        </div>
      </div>
    </footer>
  );
}
