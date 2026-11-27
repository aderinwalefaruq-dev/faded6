import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarPlus,
  CreditCard,
  QrCode,
  ScanLine,
  Share2,
  Ticket,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageMeta from '@/components/common/PageMeta';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { QrCode as QrImage } from '@/components/tickets/QrCode';
import { calculateServiceFee } from '@/lib/fees';
import { naira } from '@/lib/format';

const HERO_IMAGE =
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_cf3aa7b6-b8bb-4639-a5ba-ed25e1d11fc3.jpg';
const VENUE_IMAGE =
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_1f28b537-41fa-4a68-922e-d1365c8b096c.jpg';

const STEPS = [
  {
    icon: CalendarPlus,
    title: 'Build the event',
    body: 'Add your flyer, date, venue and as many ticket tiers as you need — Regular, VIP, Table for 5. Free tiers are welcome.',
  },
  {
    icon: Share2,
    title: 'Share one link',
    body: 'Every event gets a public page and a printable Faded6 Instant Gate Pass. Post the link, print the pass, get paid in Naira.',
  },
  {
    icon: ScanLine,
    title: 'Scan at the door',
    body: 'Open the gate scanner in your browser. Green means admit, amber means already used, red means not your event.',
  },
];

const FEATURES = [
  {
    icon: CreditCard,
    title: 'Paystack in Naira',
    body: 'Card, bank transfer, USSD and OPay — all handled inside the official Paystack modal. Buyers never leave your event page.',
  },
  {
    icon: Ticket,
    title: 'Instant QR tickets',
    body: 'Every ticket carries a unique F6- code, shown on screen and emailed to the buyer the moment payment clears.',
  },
  {
    icon: Users,
    title: 'No buyer accounts',
    body: 'Guests only enter a name and email. Fewer steps, fewer drop-offs at checkout.',
  },
  {
    icon: BadgeCheck,
    title: 'Simple pricing',
    body: '5% of the ticket total + ₦175 once per paid order. Free events pay nothing at all.',
  },
];

// Pricing example shown on the page - computed so it can never drift from the real formula.
const EXAMPLE_SUBTOTAL = 6000;
const EXAMPLE_FEE = calculateServiceFee(EXAMPLE_SUBTOTAL);

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageMeta
        title="Faded6 Ticket Platform"
        description="Faded6 — the ticket platform for Nigerian nightlife, concerts and campus events. Paystack checkout in Naira, instant QR tickets, and a built-in gate scanner."
      />
      <PublicHeader />

      <main className="flex-1">
        <section className="halftone relative overflow-hidden border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12 md:px-6 md:pb-24 md:pt-20">
            <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-electric" />
                  <span className="text-[11px] uppercase tracking-[0.24em] text-electric">
                    Faded6 Ticket Platform
                  </span>
                </div>

                <h1 className="mt-5 font-display text-3xl font-bold leading-[1.05] text-balance md:text-6xl">
                  Sell out the show.
                  <br />
                  <span className="text-electric">Scan them in.</span>
                </h1>

                <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty md:text-base">
                  Built for Nigerian nightlife, concerts and campus events. A public event page,
                  Paystack checkout in Naira, and a gate scanner that runs in the browser you
                  already have. No app to install, no buyer accounts to create.
                </p>

                <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
                  <Button asChild size="lg" className="electric-glow w-full md:w-auto">
                    <Link to="/login?mode=signup">
                      Create your event
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg" className="w-full md:w-auto">
                    <Link to="/login">I already host</Link>
                  </Button>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-electric" />
                    Paystack secured
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-electric" />
                    5% + ₦175 fee
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-electric" />
                    Works on any phone
                  </span>
                </div>
              </div>

              <div className="relative min-w-0">
                <div className="overflow-hidden rounded-lg border border-electric/30 bg-card p-1.5">
                  <div className="aspect-[4/5] w-full overflow-hidden rounded bg-muted md:aspect-[4/4.2]">
                    <img
                      src={HERO_IMAGE}
                      alt="Crowd at a Lagos concert with stage lights"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                <div className="absolute -bottom-5 left-2 w-[68%] max-w-[260px] rounded-lg border border-border bg-card p-3 shadow-card md:-left-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-white p-1">
                      <QrImage value="F6-8492-XK" size={48} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-electric">
                        Admit one
                      </p>
                      <p className="truncate font-display text-sm font-semibold">VIP · Row A</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        F6-8492-XK
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 pt-12 md:px-6 md:pt-16">
          <div className="hairline">
            <span className="text-[11px] uppercase tracking-[0.24em]">How it works</span>
          </div>
        </div>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, index) => (
              <div key={step.title} className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-electric/40 text-electric">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="font-display text-2xl font-bold text-electric/30">
                    0{index + 1}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-lg font-semibold text-balance">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-6 md:py-16">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-electric">At the gate</p>
              <h2 className="mt-3 font-display text-xl font-semibold text-balance md:text-3xl">
                A scanner that speaks plainly.
              </h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                Point the camera at a guest&apos;s QR. The screen turns green for a valid ticket,
                amber when it has already been used — with the exact time it was first scanned —
                and red when the ticket belongs to another event.
              </p>

              <div className="mt-6 flex flex-col gap-2">
                <div className="flex items-center gap-3 rounded border border-success/30 bg-success/10 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
                  <span className="text-sm font-medium text-success">
                    Valid ticket — admit one
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded border border-warning/30 bg-warning/10 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
                  <span className="text-sm font-medium text-warning">
                    Already used — 9:42 PM
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" />
                  <span className="text-sm font-medium text-destructive">Invalid ticket</span>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="overflow-hidden rounded-lg border border-electric/30 bg-background p-1.5">
                <div className="aspect-[4/3] w-full overflow-hidden rounded bg-muted">
                  <img
                    src={VENUE_IMAGE}
                    alt="Guests arriving at an evening event venue"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex min-w-0 gap-4 rounded-lg border border-border bg-card p-5 shadow-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-electric">
                  <feature.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
          <div className="halftone relative overflow-hidden rounded-xl border border-electric/25 bg-card px-6 py-10 md:px-12 md:py-14">
            <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-electric">
                  Simple pricing
                </p>
                <h2 className="mt-3 font-display text-xl font-semibold text-balance md:text-3xl">
                  5% + ₦175 per paid order. That is the whole fee.
                </h2>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                  The ₦175 is charged once per order and the 5% scales with the ticket total, so the
                  fee stays fair on small and big orders alike. Free tickets carry no fee at all,
                  so community events stay free.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">2 × ₦3,000 ticket</span>
                  <span className="font-medium">{naira(EXAMPLE_SUBTOTAL)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="font-medium">{naira(EXAMPLE_FEE)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Total payable</span>
                  <span className="font-display text-lg font-bold text-electric">
                    {naira(EXAMPLE_SUBTOTAL + EXAMPLE_FEE)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
