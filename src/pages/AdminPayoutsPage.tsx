import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HostShell } from '@/components/layout/HostShell';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminListPayouts,
  adminResolvePayout,
  type AdminPayoutRow,
  type PayoutStatus,
} from '@/services/payouts';
import { formatDateTime, naira } from '@/lib/format';

const FILTERS: { value: PayoutStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

const HOURS = 60 * 60 * 1000;

export default function AdminPayoutsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [filter, setFilter] = useState<PayoutStatus>('pending');
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState<{ row: AdminPayoutRow; mode: 'paid' | 'rejected' } | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      setRows(await adminListPayouts(filter));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load payouts');
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  };

  const openDialog = (row: AdminPayoutRow, mode: 'paid' | 'rejected') => {
    setTarget({ row, mode });
    setNote('');
    setDialogError('');
  };

  const handleConfirm = async () => {
    if (!target) return;
    if (target.mode === 'rejected' && !note.trim()) {
      setDialogError('Give the host a reason.');
      return;
    }
    setWorking(true);
    setDialogError('');
    try {
      await adminResolvePayout(target.row.id, target.mode, note.trim());
      toast.success(target.mode === 'paid' ? 'Marked as paid' : 'Request rejected');
      setTarget(null);
      await load();
    } catch (resolveError) {
      setDialogError(resolveError instanceof Error ? resolveError.message : 'Could not update');
    } finally {
      setWorking(false);
    }
  };

  if (profile && !isAdmin) {
    return (
      <HostShell>
        <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 font-display text-lg font-semibold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This page is for the Faded6 team to process payout requests.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </HostShell>
    );
  }

  return (
    <HostShell>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-electric">Admin</p>
          <h1 className="mt-1.5 font-display text-xl font-semibold md:text-3xl">Payout requests</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Send the money from your Paystack dashboard or bank app, then mark the request as paid.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? 'default' : 'secondary'}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-electric" />
          </div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No {filter} requests.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {rows.map((row) => {
              const changedRecently =
                new Date(row.created_at).getTime() - new Date(row.account_updated_at).getTime() <
                48 * HOURS;
              return (
                <div
                  key={row.id}
                  className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.host_name || 'Unnamed host'}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.host_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-semibold">{naira(row.amount_ngn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{row.bank_name}</p>
                      {row.name_verified ? (
                        <Badge className="bg-success/20 text-success hover:bg-success/20">
                          Name verified by Paystack
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Name typed by host, not verified</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-mono text-base">{row.account_number}</span>
                      <button
                        type="button"
                        onClick={() => copy(row.account_number, 'Account number')}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Copy account number"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{row.account_name}</p>
                  </div>

                  {row.status === 'pending' && changedRecently && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-pretty">
                        The host changed their bank details less than 48 hours before this request
                        (on {formatDateTime(row.account_updated_at)}). Confirm it is really them
                        before paying.
                      </span>
                    </div>
                  )}

                  {row.status === 'pending' ? (
                    <div className="mt-4 flex flex-col gap-2 md:flex-row">
                      <Button type="button" onClick={() => openDialog(row, 'paid')}>
                        Mark as paid
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => openDialog(row, 'rejected')}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {row.status === 'paid' ? 'Paid' : 'Rejected'}{' '}
                      {row.processed_at ? formatDateTime(row.processed_at) : ''}
                      {row.admin_note ? ` · ${row.admin_note}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !working && !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.mode === 'paid' ? 'Mark as paid' : 'Reject request'}
            </DialogTitle>
            <DialogDescription>
              {target
                ? target.mode === 'paid'
                  ? `Confirm you have sent ${naira(target.row.amount_ngn)} to ${target.row.account_name} (${target.row.bank_name}).`
                  : `${target.row.host_name || 'The host'} will see your reason, and the ${naira(target.row.amount_ngn)} returns to their available balance.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-note" className="text-xs">
              {target?.mode === 'paid' ? 'Transfer reference (optional)' : 'Reason'}
            </Label>
            {target?.mode === 'paid' ? (
              <Input
                id="payout-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Paystack transfer ref"
                className="h-10 px-3"
              />
            ) : (
              <Textarea
                id="payout-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Why is this being rejected?"
                className="px-3 py-2"
              />
            )}
            {dialogError && <p className="text-xs text-destructive">{dialogError}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setTarget(null)} disabled={working}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={working}>
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {target?.mode === 'paid' ? 'Confirm paid' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HostShell>
  );
}
