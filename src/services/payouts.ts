import { supabase } from '@/db/supabase';

export interface PayoutBalance {
  earned_ngn: number;
  held_ngn: number;
  pending_ngn: number;
  paid_out_ngn: number;
  available_ngn: number;
  min_payout_ngn: number;
}

export interface PayoutAccount {
  host_id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  name_verified: boolean;
  updated_at: string;
}

export type PayoutStatus = 'pending' | 'paid' | 'rejected';

export interface PayoutRequest {
  id: string;
  host_id: string;
  amount_ngn: number;
  status: PayoutStatus;
  bank_name: string;
  account_number: string;
  account_name: string;
  name_verified: boolean;
  account_updated_at: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface AdminPayoutRow extends Omit<PayoutRequest, 'host_id'> {
  host_id: string;
  host_name: string | null;
  host_email: string | null;
}

export interface Bank {
  name: string;
  code: string;
}

export type SaveAccountResult =
  | { status: 'saved'; account: PayoutAccount }
  | { status: 'needs_name'; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  NO_BANK_ACCOUNT: 'Add your bank account first.',
  REQUEST_PENDING: 'You already have a payout request waiting to be processed.',
  BELOW_MINIMUM: 'That is below the minimum payout amount.',
  INSUFFICIENT_BALANCE: 'That is more than your available balance.',
  NOT_AUTHENTICATED: 'Please sign in again.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_PENDING: 'This request has already been processed.',
  NOTE_REQUIRED: 'Please give a reason so the host knows why.',
  INVALID_STATUS: 'Invalid action.',
};

/** Turns Postgres / edge-function errors into something a host can read. */
async function friendlyError(error: unknown): Promise<Error> {
  const context = (error as { context?: { text?: () => Promise<string> } })?.context;
  if (context?.text) {
    try {
      const parsed = JSON.parse(await context.text()) as { error?: string };
      if (parsed?.error) return new Error(parsed.error);
    } catch {
      // fall through
    }
  }
  const message = String((error as { message?: string })?.message ?? '');
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  return new Error(code ? ERROR_MESSAGES[code] : message || 'Something went wrong');
}

export async function getPayoutBalance(): Promise<PayoutBalance> {
  const { data, error } = await supabase.rpc('host_payout_balance');
  if (error) throw await friendlyError(error);
  const row = (data ?? {}) as Partial<PayoutBalance>;
  return {
    earned_ngn: Number(row.earned_ngn ?? 0),
    held_ngn: Number(row.held_ngn ?? 0),
    pending_ngn: Number(row.pending_ngn ?? 0),
    paid_out_ngn: Number(row.paid_out_ngn ?? 0),
    available_ngn: Number(row.available_ngn ?? 0),
    min_payout_ngn: Number(row.min_payout_ngn ?? 1000),
  };
}

export async function getPayoutAccount(): Promise<PayoutAccount | null> {
  const { data, error } = await supabase
    .from('payout_accounts')
    .select('host_id, bank_code, bank_name, account_number, account_name, name_verified, updated_at')
    .maybeSingle();
  if (error) throw await friendlyError(error);
  return (data as PayoutAccount | null) ?? null;
}

export async function listMyPayouts(): Promise<PayoutRequest[]> {
  const { data, error } = await supabase
    .from('payout_requests')
    .select(
      'id, host_id, amount_ngn, status, bank_name, account_number, account_name, name_verified, account_updated_at, admin_note, created_at, processed_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw await friendlyError(error);
  return (data ?? []) as PayoutRequest[];
}

export async function requestPayout(amountNgn: number): Promise<void> {
  const { error } = await supabase.rpc('request_payout', { p_amount: Math.round(amountNgn) });
  if (error) throw await friendlyError(error);
}

export async function listBanks(): Promise<Bank[]> {
  const { data, error } = await supabase.functions.invoke('payout-account', {
    body: { action: 'banks' },
  });
  if (error) throw await friendlyError(error);
  return Array.isArray(data?.banks) ? (data.banks as Bank[]) : [];
}

export async function savePayoutAccount(input: {
  bankCode: string;
  accountNumber: string;
  accountName?: string;
}): Promise<SaveAccountResult> {
  const { data, error } = await supabase.functions.invoke('payout-account', {
    body: {
      action: 'save',
      bank_code: input.bankCode,
      account_number: input.accountNumber,
      account_name: input.accountName ?? '',
    },
  });
  if (error) throw await friendlyError(error);
  return data as SaveAccountResult;
}

export async function adminListPayouts(status?: PayoutStatus): Promise<AdminPayoutRow[]> {
  const { data, error } = await supabase.rpc('admin_list_payouts', { p_status: status ?? null });
  if (error) throw await friendlyError(error);
  return (data ?? []) as AdminPayoutRow[];
}

export async function adminResolvePayout(
  id: string,
  status: 'paid' | 'rejected',
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_payout', {
    p_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) throw await friendlyError(error);
}
