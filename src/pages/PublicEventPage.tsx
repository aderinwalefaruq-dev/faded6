import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Ticket as TicketIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PageMeta from '@/components/common/PageMeta';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { getEventBySlug } from '@/services/events';
import { createOrder, getPaymentConfig, verifyPayment, type PaymentConfig } from '@/services/orders';
import { formatEventDate, formatEventTime, naira } from '@/lib/format';
import {
  envPaystackKey,
  isTestKey,
  isValidPaystackKey,
  openPaystackCheckout,
  PaymentCancelledError,
} from '@/lib/paystack';
import type { EventWithTiers } from '@/types/types';

const SERVICE_FEE = 350;

export default function PublicEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventWithTiers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError('');
    try {
      const row = await getEventBySlug(slug);
      if (!row) {
        setError('This event link is not valid.');
        return;
      }
      setEvent(row);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this event');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    getPaymentConfig()
      .then((config) => {
        if (active) setPaymentConfig(config);
      })
      .catch(() => {
        if (active) setPaymentConfig({ public_key: '', configured: false, mode: 'unknown' });
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity })),
    [quantities],
  );

  const subtotal = useMemo(() => {
    if (!event) return 0;
    return selected.reduce((sum, item) => {
      const tier = event.ticket_tiers.find((row) => row.id === item.tierId);
      return sum + (tier ? tier.price_ngn * item.quantity : 0);
    }, 0);
  }, [event, selected]);

  const serviceFee = subtotal > 0 ? SERVICE_FEE : 0;
  const total = subtotal + serviceFee;
  // The server's key is the source of truth: it is the one that matches the secret key
  // used to verify payments. The build-time key is only a fallback.
  const resolvedKey = paymentConfig?.public_key || envPaystackKey() || '';
  const testMode = isTestKey(resolvedKey);
  const showSetupWarning =
    paymentConfig !== null && !paymentConfig.configured && !isValidPaystackKey(envPaystackKey());
  const ticketCount = selected.reduce((sum, item) => sum + item.quantity, 0);

  const setQuantity = (tierId: string, next: number, max: number) => {
    const clamped = Math.max(0, Math.min(next, max));
    setQuantities((current) => ({ ...current, [tierId]: clamped }));
  };

  const handlePay = async () => {
    if (!event) return;
    setFormError('');

    if (buyerName.trim().length < 2) {
      setFormError('Enter the full name for the tickets.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
      setFormError('Enter a valid email address — your tickets are sent there.');
      return;
    }
    if (selected.length === 0) {
      setFormError('Choose at least one ticket.');
      return;
    }

    setProcessing(true);
    try {
      const order = await createOrder({
        eventId: event.id,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        items: selected.map((item) => ({ tier_id: item.tierId, quantity: item.quantity })),
      });

      if (order.status === 'paid') {
        const bundle = await verifyPayment(order.reference);
        const firstCode = bundle.tickets[0]?.ticket_code;
        navigate(firstCode ? `/ticket/${firstCode}` : `/t/${order.reference}`, { replace: true });
        return;
      }

      const publicKey =
        (order.public_key ?? '').trim() || paymentConfig?.public_key || envPaystackKey();
      if (!isValidPaystackKey(publicKey)) {
        setFormError(
          'Payments are not set up yet (missing or invalid Paystack public key). Please contact the organiser.',
        );
        return;
      }

      const tierLabel =
        selected
          .map((item) => {
            const tier = event.ticket_tiers.find((row) => row.id === item.tierId);
            return tier ? `${item.quantity} × ${tier.name}` : '';
          })
          .filter(Boolean)
          .join(', ') || 'General admission';

      // The checkout dialog is modal and blocks every click outside itself, including
      // Paystack's popup. Close it first and bring it back if the payment doesn't finish.
      setCheckoutOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 350));

      await openPaystackCheckout({
        publicKey,
        email: buyerEmail.trim(),
        amountKobo: order.amount_kobo,
        reference: order.reference,
        buyerName: buyerName.trim(),
        eventId: event.id,
        tierName: tierLabel,
      });

      // The buyer has paid. From here on never show a failure: if confirmation is slow
      // (bank transfer / USSD) or errors out, the order page keeps checking by itself and
      // the Paystack webhook will issue the tickets regardless.
      let firstCode: string | undefined;
      try {
        const bundle = await verifyPayment(order.reference);
        firstCode = bundle.tickets[0]?.ticket_code;
      } catch (verifyError) {
        console.warn('Payment confirmation is still pending', verifyError);
        toast.info('Payment received — confirming your tickets…');
      }
      navigate(firstCode ? `/ticket/${firstCode}` : `/t/${order.reference}`, { replace: true });
    } catch (payError) {
      setCheckoutOpen(true);
      if (payError instanceof PaymentCancelledError) {
        setFormError('Payment window closed. No ticket was issued.');
        toast.info('Payment cancelled — no ticket was issued.');
        return;
      }
      const message = payError instanceof Error ? payError.message : 'Payment failed';
      setFormError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-electric" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHeader />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <TicketIcon className="h-8 w-8 text-electric" />
          <h1 className="mt-4 font-display text-xl font-semibold">Event not found</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {error || 'This link may have expired or the event was removed.'}
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Back to Faded6</Link>
          </Button>
        </div>
      </div>
    );
  }

  const capacity = event.ticket_tiers.reduce((sum, tier) => sum + tier.quantity_total, 0);
  const sold = event.ticket_tiers.reduce((sum, tier) => sum + tier.quantity_sold, 0);
  const allSoldOut = capacity > 0 && sold >= capacity;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1 pb-28 md:pb-0">
        <PageMeta
          title={`${event.title} — Faded6`}
          description={`${event.title} at ${event.venue}. Get your tickets on Faded6.`}
        />
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6 md:pt-10">
          <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] md:gap-10">
            <div className="min-w-0">
              <div className="overflow-hidden border-2 border-electric/40 bg-muted p-1.5">
                <div className="overflow-hidden aspect-[4/3] w-full overflow-hidden bg-muted">
                  {event.banner_url ? (
                    <img
                      src={event.banner_url}
                      alt={`${event.title} flyer`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary">
                      <TicketIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2">
                  {allSoldOut ? (
                    <Badge variant="destructive" className="text-[11px] uppercase tracking-wide">
                      Sold out
                    </Badge>
                  ) : (
                    <Badge className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wide">
                      On sale
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {Math.max(capacity - sold, 0)} of {capacity} tickets left
                  </span>
                </div>

                <h1 className="mt-3 font-display text-xl font-semibold leading-tight text-balance md:text-4xl">
                  {event.title}
                </h1>

                <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                  <span className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                    <span>
                      {formatEventDate(event.event_date)} · {formatEventTime(event.event_date)}
                    </span>
                  </span>
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                    <span className="break-words">{event.venue}</span>
                  </span>
                </div>

                {event.description && (
                  <div className="mt-6 border-t border-border pt-5">
                    <h2 className="font-display text-base font-semibold">About this event</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">
                      {event.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="rounded-xl border border-border bg-card p-4 shadow-card md:sticky md:top-24 md:p-5">
                <h2 className="font-display text-base font-semibold">Choose your tickets</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  A flat ₦350 service fee applies once per paid order.
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  {event.ticket_tiers.map((tier) => {
                    const remaining = Math.max(tier.quantity_total - tier.quantity_sold, 0);
                    const soldOut = remaining === 0;
                    const quantity = quantities[tier.id] ?? 0;

                    return (
                      <div
                        key={tier.id}
                        className={
                          soldOut
                            ? 'rounded-lg border border-border bg-muted/50 p-3 opacity-70'
                            : 'rounded-lg border border-border bg-background/60 p-3'
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{tier.name}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {tier.price_ngn === 0 ? 'Free' : naira(tier.price_ngn)}
                              <span className="ml-2 text-xs">
                                {soldOut ? '· Sold out' : `· ${remaining} left`}
                              </span>
                            </p>
                            {tier.description?.trim() && (
                              <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground text-pretty">
                                {tier.description.trim()}
                              </p>
                            )}
                          </div>

                          {soldOut ? (
                            <Badge variant="secondary" className="shrink-0 text-[11px]">
                              Sold out
                            </Badge>
                          ) : (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setQuantity(tier.id, quantity - 1, remaining)}
                                disabled={quantity === 0}
                                aria-label={`Remove one ${tier.name}`}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium tabular-nums">
                                {quantity}
                              </span>
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setQuantity(tier.id, quantity + 1, remaining)}
                                disabled={quantity >= remaining}
                                aria-label={`Add one ${tier.name}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{naira(subtotal)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Service fee</span>
                    <span className="font-medium">{naira(serviceFee)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">Total payable</span>
                    <span className="font-display text-lg font-semibold">{naira(total)}</span>
                  </div>

                  <Button
                    size="lg"
                    className="mt-4 hidden w-full md:flex"
                    disabled={ticketCount === 0 || allSoldOut}
                    onClick={() => setCheckoutOpen(true)}
                  >
                    {allSoldOut
                      ? 'Sold out'
                      : ticketCount === 0
                        ? 'Select tickets'
                        : `Get ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}`}
                  </Button>

                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-electric" />
                    Secured by Paystack · NGN
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {ticketCount} ticket{ticketCount === 1 ? '' : 's'}
            </p>
            <p className="font-display text-base font-semibold">{naira(total)}</p>
          </div>
          <Button
            className="shrink-0"
            disabled={ticketCount === 0 || allSoldOut}
            onClick={() => setCheckoutOpen(true)}
          >
            {allSoldOut ? 'Sold out' : 'Get tickets'}
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <PublicFooter />
      </div>

      <Dialog open={checkoutOpen} onOpenChange={(open) => !processing && setCheckoutOpen(open)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Checkout</DialogTitle>
            <DialogDescription>
              Your tickets are issued instantly and emailed to you.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buyerName">Full name</Label>
              <Input
                id="buyerName"
                value={buyerName}
                onChange={(changeEvent) => setBuyerName(changeEvent.target.value)}
                placeholder="Adaeze Okafor"
                autoComplete="name"
                className="h-11 px-3"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buyerEmail">Email address</Label>
              <Input
                id="buyerEmail"
                type="email"
                value={buyerEmail}
                onChange={(changeEvent) => setBuyerEmail(changeEvent.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 px-3"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3">
              {selected.map((item) => {
                const tier = event.ticket_tiers.find((row) => row.id === item.tierId);
                if (!tier) return null;
                return (
                  <div
                    key={item.tierId}
                    className="flex items-center justify-between py-1 text-sm"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {item.quantity} × {tier.name}
                    </span>
                    <span className="shrink-0 font-medium">
                      {naira(tier.price_ngn * item.quantity)}
                    </span>
                  </div>
                );
              })}

              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">Ticket subtotal</span>
                <span className="font-medium">{naira(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">Service fee</span>
                <span className="font-medium">{naira(serviceFee)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">Total payable</span>
                <span className="font-display text-base font-semibold">{naira(total)}</span>
              </div>
            </div>

            {total > 0 && showSetupWarning && (
              <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-warning">Payments may not be set up yet</p>
                  <p className="mt-0.5 text-xs text-warning/80 text-pretty">
                    The server reports that Paystack is not fully configured. Checkout will refuse
                    to charge you until the organiser finishes setup.
                  </p>
                </div>
              </div>
            )}

            {formError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button size="lg" onClick={handlePay} disabled={processing} className="w-full">
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {total === 0 ? 'Claim free tickets' : `Pay ${naira(total)}`}
            </Button>

            {testMode && total > 0 && (
              <p className="text-center text-[11px] text-warning">
                Test mode — no real money will be charged.
              </p>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              By paying you accept the organiser&apos;s terms. Tickets are non-refundable.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
