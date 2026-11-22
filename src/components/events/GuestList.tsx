import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Download, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  checkInTicket,
  downloadGuestListCsv,
  listEventTickets,
  type GuestTicketRow,
} from '@/services/tickets';
import { formatDateTime, naira } from '@/lib/format';
import type { TicketTier } from '@/types/types';

interface GuestListProps {
  eventId: string;
  eventSlug: string;
  tiers: TicketTier[];
  onCheckedIn?: () => void;
}

export function GuestList({ eventId, eventSlug, tiers, onCheckedIn }: GuestListProps) {
  const [rows, setRows] = useState<GuestTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await listEventTickets(eventId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the guest list');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (tierFilter !== 'all' && row.tier_id !== tierFilter) return false;
      if (statusFilter === 'checked' && !row.is_checked_in) return false;
      if (statusFilter === 'pending' && row.is_checked_in) return false;
      if (!needle) return true;

      return (
        row.buyer_name.toLowerCase().includes(needle) ||
        row.buyer_email.toLowerCase().includes(needle) ||
        row.ticket_code.toLowerCase().includes(needle)
      );
    });
  }, [rows, query, tierFilter, statusFilter]);

  const checkedInCount = rows.filter((row) => row.is_checked_in).length;

  const handleCheckIn = async (row: GuestTicketRow) => {
    setBusyId(row.id);
    try {
      const checkedInAt = await checkInTicket(row.id);
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, is_checked_in: true, checked_in_at: checkedInAt } : item,
        ),
      );
      toast.success(`${row.buyer_name} checked in`);
      onCheckedIn?.();
    } catch (checkInError) {
      toast.error(
        checkInError instanceof Error ? checkInError.message : 'Could not check this guest in',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('There is nobody to export yet');
      return;
    }
    downloadGuestListCsv(filtered, `${eventSlug}-guest-list.csv`);
    toast.success(`Exported ${filtered.length} guest${filtered.length === 1 ? '' : 's'}`);
  };

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate font-display text-base font-semibold">Guest list</h2>
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}
          </Badge>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          disabled={rows.length === 0}
          className="w-full shrink-0 md:w-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          Export guest list (CSV)
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
            placeholder="Search name, email or F6- code"
            className="h-11 pl-9 pr-3"
            aria-label="Search the guest list"
          />
        </div>

        <div className="flex gap-2">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-11 min-w-0 flex-1 md:w-40" aria-label="Filter by tier">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 min-w-0 flex-1 md:w-40" aria-label="Filter by check-in">
              <SelectValue placeholder="All guests" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All guests</SelectItem>
              <SelectItem value="checked">Checked in</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-electric" />
        </div>
      ) : error ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" size="sm" onClick={load} className="mt-3">
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-electric">
            <Users className="h-5 w-5" />
          </span>
          <p className="font-display text-sm font-semibold">No tickets sold yet</p>
          <p className="max-w-xs text-xs text-muted-foreground text-pretty">
            Share the event link or print the gate pass — buyers will appear here the moment they
            pay.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">No guests match those filters.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setQuery('');
              setTierFilter('all');
              setStatusFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[1.5fr_0.9fr_1.1fr_auto] gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground md:grid">
            <span>Buyer</span>
            <span>Tier</span>
            <span>Ticket &amp; payment</span>
            <span className="text-right">Check-in</span>
          </div>

          <ul className="divide-y divide-border">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-4 py-3 md:grid md:grid-cols-[1.5fr_0.9fr_1.1fr_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.buyer_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.buyer_email}</p>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm">{row.tier_name}</p>
                </div>

                <div className="min-w-0">
                  <p className="font-mono text-xs tracking-wide text-electric">{row.ticket_code}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {naira(row.amount_paid_ngn)} · {row.paystack_reference ?? 'Free order'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <div className="min-w-0">
                    {row.is_checked_in ? (
                      <Badge className="border-success/40 bg-success/15 text-success">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Checked in
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        <Clock className="mr-1 h-3 w-3" />
                        Not scanned
                      </Badge>
                    )}
                    {row.is_checked_in && row.checked_in_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDateTime(row.checked_in_at)}
                      </p>
                    )}
                  </div>

                  {!row.is_checked_in && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCheckIn(row)}
                      disabled={busyId === row.id}
                      className="shrink-0"
                    >
                      {busyId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Check in'
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              Showing {filtered.length} of {rows.length}
            </span>
            <span className="shrink-0">
              {checkedInCount} checked in · {rows.length - checkedInCount} pending
            </span>
          </div>
        </>
      )}
    </section>
  );
}
