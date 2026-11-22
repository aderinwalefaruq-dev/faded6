import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEventDate, formatEventTime, naira } from '@/lib/format';
import type { EventWithTiers } from '@/types/types';

interface EventCardProps {
  event: EventWithTiers;
  ticketsSold: number;
  revenueNgn: number;
}

export function EventCard({ event, ticketsSold, revenueNgn }: EventCardProps) {
  const capacity = event.ticket_tiers.reduce((sum, tier) => sum + tier.quantity_total, 0);
  const remaining = Math.max(capacity - ticketsSold, 0);
  const soldOut = capacity > 0 && remaining === 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-hover">
      <div className="relative">
        <div className="overflow-hidden aspect-[16/10] w-full bg-muted">
          {event.banner_url ? (
            <img
              src={event.banner_url}
              alt={`${event.title} banner`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="absolute left-3 top-3 flex gap-2">
          {soldOut ? (
            <Badge variant="destructive" className="text-[11px] uppercase tracking-wide">
              Sold out
            </Badge>
          ) : (
            <Badge className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wide">
              On sale
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold leading-snug text-balance">
            <Link to={`/dashboard/events/${event.id}`} className="hover:text-electric">
              {event.title}
            </Link>
          </h3>
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {formatEventDate(event.event_date)} · {formatEventTime(event.event_date)}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </span>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sold</p>
            <p className="font-display text-base font-semibold">{ticketsSold}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Left</p>
            <p className="font-display text-base font-semibold">{remaining}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Revenue</p>
            <p className="font-display text-base font-semibold">{naira(revenueNgn)}</p>
          </div>
        </div>

        <Button asChild variant="secondary" className="w-full justify-between">
          <Link to={`/dashboard/events/${event.id}`}>
            Manage event
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
