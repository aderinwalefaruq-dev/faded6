import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Download, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageMeta from '@/components/common/PageMeta';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { QrCode } from '@/components/tickets/QrCode';
import { getOrder, getTicketBundle, verifyPayment } from '@/services/orders';
import { formatDateTime, formatEventDate, formatEventTime, naira } from '@/lib/format';
import { downloadQr } from '@/lib/qr';
import type { OrderBundle } from '@/types/types';

export default function TicketPage() {
  const { reference, code } = useParams<{ reference?: string; code?: string }>();
  const [bundle, setBundle] = useState<OrderBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');

  const load = useCallback(async () => {
    if (!reference && !code) return;
    setLoading(true);
    setError('');
    try {
      const data = code ? await getTicketBundle(code) : await getOrder(reference as string);
      setBundle(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this order');
    } finally {
      setLoading(false);
    }
  }, [reference, code]);

  useEffect(() => {
    load();
  }, [load]);

  // While an order is pending, quietly re-check it (bank transfer / USSD can take a minute).
  useEffect(() => {
    if (!reference || !bundle || bundle.order.status === 'paid') return;

    let cancelled = false;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 30) {
        window.clearInterval(timer);
        return;
      }
      try {
        const data = await verifyPayment(reference);
        if (!cancelled) setBundle(data);
      } catch {
        // still pending — keep waiting
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [reference, bundle]);

  const handleRetry = async () => {
    if (!reference) {
      await load();
      return;
    }
    setRetrying(true);
    setRetryMessage('');
    try {
      const data = await verifyPayment(reference);
      setBundle(data);
    } catch (retryError) {
      setRetryMessage(
        retryError instanceof Error ? retryError.message : 'Payment is still pending',
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleDownload = async (code: string) => {
    await downloadQr(code, `${code}.png`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-electric" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHeader />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <h1 className="font-display text-xl font-semibold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {error || 'Check the link in your confirmation email.'}
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Back to Faded6</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { order, tickets, event } = bundle;
  const isPaid = order.status === 'paid';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <PageMeta
          title="Your tickets — Faded6"
          description="Your digital tickets and QR codes for this event."
        />
        {isPaid ? (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-electric">
              Payment confirmed
            </p>
            <h1 className="mt-2 font-display text-xl font-semibold text-balance md:text-3xl">
              You&apos;re in. Here are your tickets.
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground text-pretty">
              Show the QR code at the gate. Keep this page bookmarked — it is your ticket wallet,
              and it works even without a signal.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
              <Loader2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold md:text-2xl">
              Waiting for payment confirmation
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground text-pretty">
              We have not received confirmation from Paystack yet. If you were charged, tap the
              button below.
            </p>
            <Button onClick={handleRetry} disabled={retrying} className="mt-5">
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Check payment again
            </Button>
            {retryMessage && (
              <p className="mt-3 max-w-md text-xs text-muted-foreground text-pretty">
                {retryMessage}
              </p>
            )}
          </div>
        )}

        {event && (
          <div className="mt-8 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] uppercase tracking-[0.16em] text-electric">Event</p>
            <h2 className="mt-1 font-display text-base font-semibold text-balance">
              {event.title}
            </h2>
            <div className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
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
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-electric">
                    {ticket.tier_name}
                  </p>
                  <p className="truncate font-display text-base font-semibold">
                    {ticket.buyer_name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-electric/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-electric">
                  Admit one
                </span>
              </div>

              <div className="flex flex-col items-center gap-3 px-4 py-5">
                <QrCode value={ticket.ticket_code} size={200} />
                <p className="break-all text-center font-mono text-xs tracking-[0.08em] text-muted-foreground">
                  {ticket.ticket_code}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownload(ticket.ticket_code)}
                  className="w-full md:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download QR
                </Button>
              </div>

              <div className="ticket-perf mx-4" />

              <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
                <span className="truncate">Ref {order.reference}</span>
                <span className="shrink-0">
                  {ticket.is_checked_in ? 'Checked in' : 'Not yet scanned'}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-base font-semibold">Order summary</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticket subtotal</span>
              <span className="font-medium">{naira(order.subtotal_ngn)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Service fee</span>
              <span className="font-medium">{naira(order.service_fee_ngn)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-display text-base font-semibold">{naira(order.total_ngn)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Placed</span>
              <span>{formatDateTime(order.created_at)}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Keep this page bookmarked — it is your ticket wallet.
        </p>
      </main>
    </div>
  );
}
