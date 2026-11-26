import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Clock, Loader2, Lock, ShieldAlert, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HostShell } from '@/components/layout/HostShell';
import { StatTile } from '@/components/common/StatTile';
import {
  getPayoutAccount,
  getPayoutBalance,
  listBanks,
  listMyPayouts,
  requestPayout,
  savePayoutAccount,
  type Bank,
  type PayoutAccount,
  type PayoutBalance,
  type PayoutRequest,
} from '@/services/payouts';
import { formatDateTime, naira } from '@/lib/format';

const maskAccount = (value: string) => `••••${value.slice(-4)}`;

function StatusBadge({ status }: { status: PayoutRequest['status'] }) {
  if (status === 'paid') {
    return <Badge className="bg-success/20 text-success hover:bg-success/20">Paid</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

export default function PayoutsPage() {
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [history, setHistory] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [editing, setEditing] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  const [amount, setAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [balanceRow, accountRow, historyRows] = await Promise.all([
        getPayoutBalance(),
        getPayoutAccount(),
        listMyPayouts(),
      ]);
      setBalance(balanceRow);
      setAccount(accountRow);
      setHistory(historyRows);
      setEditing(!accountRow);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only fetch the bank list when the host actually needs to enter an account.
  useEffect(() => {
    if (!editing || banks.length > 0) return;
    let cancelled = false;
    setBanksLoading(true);
    listBanks()
      .then((rows) => {
        if (!cancelled) setBanks(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setAccountMessage(error instanceof Error ? error.message : 'Could not load banks');
        }
      })
      .finally(() => {
        if (!cancelled) setBanksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, banks.length]);

  const startEditing = () => {
    setBankCode(account?.bank_code ?? '');
    setAccountNumber('');
    setAccountName('');
    setNeedsName(false);
    setAccountMessage('');
    setEditing(true);
  };

  const handleSaveAccount = async () => {
    setAccountMessage('');
    if (!bankCode) {
      setAccountMessage('Choose your bank.');
      return;
    }
    if (!/^\d{10}$/.test(accountNumber.trim())) {
      setAccountMessage('Account number must be exactly 10 digits.');
      return;
    }
    setSavingAccount(true);
    try {
      const result = await savePayoutAccount({
        bankCode,
        accountNumber: accountNumber.trim(),
        accountName: needsName ? accountName : '',
      });
      if (result.status === 'needs_name') {
        setNeedsName(true);
        setAccountMessage(result.message);
        return;
      }
      setAccount(result.account);
      setEditing(false);
      setNeedsName(false);
      toast.success(
        result.account.name_verified
          ? `Account verified: ${result.account.account_name}`
          : 'Bank account saved',
      );
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Could not save the account');
    } finally {
      setSavingAccount(false);
    }
  };

  const hasPending = history.some((row) => row.status === 'pending');
  const available = balance?.available_ngn ?? 0;
  const minimum = balance?.min_payout_ngn ?? 1000;
  const amountNumber = Math.floor(Number(amount || 0));

  const handleRequest = async () => {
    setRequestError('');
    if (!account) {
      setRequestError('Add your bank account first.');
      return;
    }
    if (amountNumber < minimum) {
      setRequestError(`The minimum payout is ${naira(minimum)}.`);
      return;
    }
    if (amountNumber > available) {
      setRequestError('That is more than your available balance.');
      return;
    }
    setRequesting(true);
    try {
      await requestPayout(amountNumber);
      toast.success('Payout requested. We will review it and send the money to your account.');
      setAmount('');
      await load();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not request the payout');
    } finally {
      setRequesting(false);
    }
  };

  const canRequest = Boolean(account) && !hasPending && available >= minimum;

  return (
    <HostShell>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-electric">Payouts</p>
          <h1 className="mt-1.5 font-display text-xl font-semibold text-balance md:text-3xl">
            Withdraw your earnings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Your earnings are your ticket sales. The service fee on each order is not included.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-electric" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <StatTile
                label="Available"
                value={naira(available)}
                icon={Wallet}
                hint="Ready to withdraw"
              />
              <StatTile
                label="Held"
                value={naira(balance?.held_ngn ?? 0)}
                icon={Lock}
                hint="Released once the event starts"
              />
              <StatTile
                label="Requested"
                value={naira(balance?.pending_ngn ?? 0)}
                icon={Clock}
                hint="Awaiting payout"
              />
              <StatTile
                label="Paid out"
                value={naira(balance?.paid_out_ngn ?? 0)}
                icon={CheckCircle2}
              />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {/* Bank account */}
              <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card md:p-5">
                <h2 className="font-display text-base font-semibold">Bank account</h2>

                {account && !editing ? (
                  <div className="mt-4">
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <p className="text-sm font-medium">{account.bank_name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {maskAccount(account.account_number)} · {account.account_name}
                      </p>
                      <div className="mt-2">
                        {account.name_verified ? (
                          <Badge className="bg-success/20 text-success hover:bg-success/20">
                            Name verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Name not verified</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3 w-full md:w-auto"
                      onClick={startEditing}
                    >
                      Change account
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground text-pretty">
                      A pending request keeps the account it was made with.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="payout-bank" className="text-xs">
                        Bank
                      </Label>
                      <Select value={bankCode} onValueChange={setBankCode} disabled={banksLoading}>
                        <SelectTrigger id="payout-bank" className="h-10">
                          <SelectValue
                            placeholder={banksLoading ? 'Loading banks…' : 'Choose your bank'}
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {banks.map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>
                              {bank.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="payout-number" className="text-xs">
                        Account number
                      </Label>
                      <Input
                        id="payout-number"
                        inputMode="numeric"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ''))}
                        placeholder="10-digit NUBAN"
                        className="h-10 px-3"
                      />
                    </div>

                    {needsName && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="payout-name" className="text-xs">
                          Account name
                        </Label>
                        <Input
                          id="payout-name"
                          value={accountName}
                          onChange={(event) => setAccountName(event.target.value)}
                          placeholder="As shown by your bank"
                          className="h-10 px-3"
                        />
                      </div>
                    )}

                    {accountMessage && (
                      <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="text-pretty">{accountMessage}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 md:flex-row">
                      <Button
                        type="button"
                        onClick={handleSaveAccount}
                        disabled={savingAccount || banksLoading}
                        className="w-full md:w-auto"
                      >
                        {savingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {needsName ? 'Save account' : 'Verify & save'}
                      </Button>
                      {account && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditing(false)}
                          className="w-full md:w-auto"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Request payout */}
              <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card md:p-5">
                <h2 className="font-display text-base font-semibold">Request a payout</h2>

                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="payout-amount" className="text-xs">
                        Amount (₦)
                      </Label>
                      <button
                        type="button"
                        onClick={() => setAmount(String(available))}
                        disabled={available <= 0}
                        className="text-xs text-electric disabled:opacity-40"
                      >
                        Withdraw all
                      </button>
                    </div>
                    <Input
                      id="payout-amount"
                      inputMode="numeric"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                      placeholder={`Minimum ${naira(minimum)}`}
                      disabled={!canRequest}
                      className="h-10 px-3"
                    />
                  </div>

                  {requestError && <p className="text-xs text-destructive">{requestError}</p>}

                  <Button
                    type="button"
                    onClick={handleRequest}
                    disabled={!canRequest || requesting || amountNumber <= 0}
                    className="w-full md:w-auto"
                  >
                    {requesting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="mr-2 h-4 w-4" />
                    )}
                    {amountNumber > 0 ? `Request ${naira(amountNumber)}` : 'Request payout'}
                  </Button>

                  <p className="text-xs text-muted-foreground text-pretty">
                    {!account
                      ? 'Add your bank account to request a payout.'
                      : hasPending
                        ? 'You have a request waiting to be processed. You can make another once it is done.'
                        : available < minimum
                          ? `You can withdraw once you have at least ${naira(minimum)} available. Earnings from an event are released when it starts.`
                          : `Money goes to ${account.bank_name} ${maskAccount(account.account_number)}. Payouts are processed manually by the Faded6 team.`}
                  </p>
                </div>
              </section>
            </div>

            {/* History */}
            <section className="mt-6 min-w-0 rounded-xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display text-base font-semibold">Payout history</h2>
              </div>
              {history.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No payout requests yet.
                </p>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-max text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="whitespace-nowrap px-4 py-2.5 font-medium">Requested</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Amount</th>
                        <th className="whitespace-nowrap px-4 py-2.5 font-medium">Account</th>
                        <th className="whitespace-nowrap px-4 py-2.5 font-medium">Status</th>
                        <th className="whitespace-nowrap px-4 py-2.5 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {formatDateTime(row.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                            {naira(row.amount_ngn)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {row.bank_name} {maskAccount(row.account_number)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                            {row.admin_note ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </HostShell>
  );
}
