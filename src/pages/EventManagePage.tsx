import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  ScanLine,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { HostShell } from '@/components/layout/HostShell';
import { StatTile } from '@/components/common/StatTile';
import { QrCode } from '@/components/tickets/QrCode';
import { GuestList } from '@/components/events/GuestList';
import {
  deleteEvent,
  getEventById,
  getEventStats,
  listEventOrders,
  type EventOrderRow,
  type EventStats,
} from '@/services/events';
import { formatDateTime, formatEventDate, formatEventTime, naira } from '@/lib/format';
import { publicEventUrl } from '@/lib/slug';
import { downloadGatePassPoster } from '@/lib/qr';
import type { EventWithTiers } from '@/types/types';

export default function EventManagePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventWithTiers | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [orders, setOrders] = useState<EventOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const [eventRow, statsRow, orderRows] = await Promise.all([
        getEventById(eventId),
        getEventStats(eventId),
        listEventOrders(eventId),
      ]);
      if (!eventRow) {
        setError('This event does not exist or you do not have access to it.');
        return;
      }
      setEvent(eventRow);
      setStats(statsRow);
      setOrders(orderRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshStats = useCallback(async () => {
    if (!eventId) return;
    try {
      setStats(await getEventStats(eventId));
    } catch {
      // Stats refresh is best-effort; the guest list already reflects the change.
    }
  }, [eventId]);

  const handleCopy = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(publicEventUrl(event.slug));
      setCopied(true);
      toast.success('Event link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const handleDownloadPoster = async () => {
    if (!event) return;
    try {
      await downloadGatePassPoster({
        eventTitle: event.title,
        eventDate: `${formatEventDate(event.event_date)} · ${formatEventTime(event.event_date)}`,
        venue: event.venue,
        url: publicEventUrl(event.slug),
        filename: `${event.slug}-faded6-gate-pass.png`,
      });
    } catch {
      toast.error('Could not generate the gate pass');
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      await deleteEvent(event.id);
      toast.success('Event deleted');
      navigate('/dashboard', { replace: true });
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete event');
    }
  };

  if (loading) {
    return (
      <HostShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-electric" />
        </div>
      </HostShell>
    );
  }

  if (error || !event) {
    return (
      <HostShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-8">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error || 'Event not found'}</p>
            <Button asChild variant="secondary" className="mt-4">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </HostShell>
    );
  }

  const capacity = event.ticket_tiers.reduce((sum, tier) => sum + tier.quantity_total, 0);
  const sold = stats?.tickets_sold ?? 0;
  const remaining = Math.max(capacity - sold, 0);
  const shareUrl = publicEventUrl(event.slug);

  return (
    <HostShell>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-7">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 gap-1.5 px-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              All events
            </Link>
          </Button>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wide">
                  {event.status === 'published' ? 'On sale' : event.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatEventDate(event.event_date)} · {formatEventTime(event.event_date)}
                </span>
              </div>
              <h1 className="mt-2 font-display text-xl font-semibold text-balance md:text-3xl">
                {event.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{event.venue}</p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 md:flex-row">
              <Button asChild variant="secondary" className="w-full md:w-auto">
                <Link to={`/e/${event.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Public page
                </Link>
              </Button>
              <Button asChild className="w-full md:w-auto">
                <Link to={`/dashboard/events/${event.id}/scanner`}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  Launch gate scanner
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatTile label="Tickets sold" value={String(sold)} icon={Ticket} hint={`${capacity} capacity`} />
          <StatTile
            label="Revenue"
            value={naira(stats?.gross_revenue_ngn ?? 0)}
            icon={TrendingUp}
            hint={`${naira(stats?.fees_ngn ?? 0)} in fees`}
          />
          <StatTile label="Checked in" value={String(stats?.checked_in ?? 0)} icon={Users} />
          <StatTile label="Remaining" value={String(remaining)} icon={Ticket} />
        </div>

        <div className="mt-6">
          <GuestList
            eventId={event.id}
            eventSlug={event.slug}
            tiers={event.ticket_tiers}
            onCheckedIn={refreshStats}
          />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.5fr_1fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="min-w-0 rounded-xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="min-w-0 truncate font-display text-base font-semibold">
                  Inventory by tier
                </h2>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {event.ticket_tiers.length} tiers
                </span>
              </div>

              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tier</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Price</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Sold</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Left</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.ticket_tiers.map((tier) => {
                      const left = Math.max(tier.quantity_total - tier.quantity_sold, 0);
                      return (
                        <tr key={tier.id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 font-medium">{tier.name}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {tier.price_ngn === 0 ? 'Free' : naira(tier.price_ngn)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {tier.quantity_sold}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {left === 0 ? (
                              <span className="text-destructive">Sold out</span>
                            ) : (
                              left
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                            {tier.quantity_total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="min-w-0 rounded-xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="min-w-0 truncate font-display text-base font-semibold">
                  Recent orders
                </h2>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {stats?.orders_paid ?? 0} paid
                </span>
              </div>

              {orders.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No orders yet. Share the event link to start selling.
                </p>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-max text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="whitespace-nowrap px-4 py-2.5 font-medium">Buyer</th>
                        <th className="whitespace-nowrap px-4 py-2.5 font-medium">Reference</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                          Total
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                          Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                          Placed
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-medium">{order.buyer_name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {order.buyer_email}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                            {order.reference}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {naira(order.total_ngn)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <span
                              className={
                                order.status === 'paid'
                                  ? 'text-success'
                                  : order.status === 'failed'
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                              }
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground">
                            {formatDateTime(order.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
              <h2 className="font-display text-base font-semibold">Share &amp; sell</h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Send this link to guests, or print the gate QR for walk-up buyers.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <LabeledValue label="Public event link" value={shareUrl} />
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" onClick={handleCopy} className="w-full justify-start">
                    {copied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button asChild variant="secondary" className="w-full justify-start">
                    <Link to={`/e/${event.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open public page
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-electric">
                  Faded6 Instant Gate Pass
                </p>
                <div className="halftone mt-3 overflow-hidden rounded-lg border border-electric/30 bg-background p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold">
                      Faded<span className="text-electric">6</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Instant gate pass
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col items-center gap-3">
                    <div className="rounded-lg bg-white p-2">
                      <QrCode value={shareUrl} size={156} />
                    </div>
                    <p className="text-center font-display text-sm font-semibold text-balance">
                      Skip the queue — Scan to buy your ticket on Faded6
                    </p>
                    <p className="text-center text-xs text-muted-foreground text-pretty">
                      Print this card and post it at the entrance for walk-up buyers.
                    </p>
                    <Button onClick={handleDownloadPoster} className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download gate pass
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
              <h2 className="font-display text-base font-semibold">Event details</h2>
              <dl className="mt-3 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Date</dt>
                  <dd className="mt-0.5">
                    {formatEventDate(event.event_date)} · {formatEventTime(event.event_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Venue</dt>
                  <dd className="mt-0.5 break-words">{event.venue}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Description
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line break-words text-muted-foreground">
                    {event.description || 'No description added.'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="min-w-0 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
              <h2 className="font-display text-base font-semibold text-destructive">
                Danger zone
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Deleting an event removes its tiers, orders and tickets. This cannot be undone.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-3 w-full">
                    Delete event
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{event.title}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All ticket tiers, orders and issued tickets for this event will be removed
                      permanently.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep event</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>
        </div>
      </div>
    </HostShell>
  );
}

function LabeledValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all font-mono text-xs">{value}</p>
    </div>
  );
}
