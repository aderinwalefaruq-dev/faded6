import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Loader2, Ticket, TrendingUp, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HostShell } from '@/components/layout/HostShell';
import { EventCard } from '@/components/events/EventCard';
import { StatTile } from '@/components/common/StatTile';
import { useAuth } from '@/contexts/AuthContext';
import { getHostEventSummaries, listHostEvents, type HostEventSummary } from '@/services/events';
import { naira } from '@/lib/format';
import type { EventWithTiers } from '@/types/types';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<EventWithTiers[]>([]);
  const [summaries, setSummaries] = useState<Record<string, HostEventSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [eventRows, summaryRows] = await Promise.all([
        listHostEvents(user.id),
        getHostEventSummaries(),
      ]);
      setEvents(eventRows);
      setSummaries(summaryRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your events');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = events.reduce(
    (acc, event) => {
      const summary = summaries[event.id];
      acc.tickets += summary?.tickets_sold ?? 0;
      acc.revenue += summary?.revenue_ngn ?? 0;
      acc.checkedIn += summary?.checked_in ?? 0;
      return acc;
    },
    { tickets: 0, revenue: 0, checkedIn: 0 },
  );

  return (
    <HostShell>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-electric">Host dashboard</p>
              <h1 className="mt-1.5 font-display text-xl font-semibold text-balance md:text-3xl">
                {profile?.display_name ? `Welcome back, ${profile.display_name}` : 'Your events'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track sales, share links, and open the gate scanner.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row">
              <Button asChild variant="secondary" className="w-full md:w-auto">
                <Link to="/dashboard/payouts">
                  <Wallet className="mr-2 h-4 w-4" />
                  Withdraw earnings
                </Link>
              </Button>
              <Button asChild className="w-full md:w-auto">
                <Link to="/dashboard/events/new">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Create event
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatTile label="Events" value={String(events.length)} icon={Ticket} />
          <StatTile label="Tickets sold" value={String(totals.tickets)} icon={Users} />
          <StatTile label="Revenue" value={naira(totals.revenue)} icon={TrendingUp} />
          <StatTile label="Checked in" value={String(totals.checkedIn)} icon={Users} />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">All events</h2>
            {events.length > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {events.length} total
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-electric" />
            </div>
          ) : error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-electric">
                <Ticket className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold">No events yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
                  Create your first event, add ticket tiers, and share the link. It takes about two
                  minutes.
                </p>
              </div>
              <Button asChild>
                <Link to="/dashboard/events/new">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Create your first event
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  ticketsSold={summaries[event.id]?.tickets_sold ?? 0}
                  revenueNgn={summaries[event.id]?.revenue_ngn ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </HostShell>
  );
}
