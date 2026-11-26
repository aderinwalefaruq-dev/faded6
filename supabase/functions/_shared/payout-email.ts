/**
 * Admin alert for a new payout request, sent through Resend.
 * Every host-controlled value is HTML-escaped; the link comes from the SITE_URL secret
 * (never from the request), so a host cannot plant a phishing link in your inbox.
 */
const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const naira = (value: number) => `\u20A6${Number(value).toLocaleString('en-NG')}`;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(date);
}

export interface PayoutRequestEmail {
  recipients: string[];
  hostName: string;
  hostEmail: string;
  amountNgn: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  nameVerified: boolean;
  accountChangedRecently: boolean;
  accountUpdatedAt: string;
  requestedAt: string;
  adminUrl: string | null;
}

export async function sendPayoutRequestEmail(payload: PayoutRequestEmail): Promise<void> {
  const apiKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim();
  if (!apiKey) {
    console.log('RESEND_API_KEY not configured - payout alert email skipped');
    return;
  }
  if (payload.recipients.length === 0) {
    console.error('Payout alert not sent: set ADMIN_NOTIFY_EMAIL (or make an account an admin)');
    return;
  }

  const from = (
    Deno.env.get('NOTIFY_EMAIL_FROM') ??
    Deno.env.get('TICKET_EMAIL_FROM') ??
    'Faded6 <onboarding@resend.dev>'
  ).trim();

  const hostLabel = payload.hostName || payload.hostEmail || 'A host';
  const subject = `Payout request: ${naira(payload.amountNgn)} from ${hostLabel}`
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 150);

  const warning = payload.accountChangedRecently
    ? `<tr><td style="padding:0 24px 16px;">
        <div style="padding:12px 14px;border-radius:8px;background:#FEF3C7;color:#92400E;font-size:13px;line-height:1.5;">
          <strong>Check before paying:</strong> this host changed their bank details less than 48 hours before
          requesting (on ${esc(formatDate(payload.accountUpdatedAt))}). Confirm it is really them.
        </div>
      </td></tr>`
    : '';

  const verification = payload.nameVerified
    ? '<span style="color:#047857;">Name verified by Paystack</span>'
    : '<span style="color:#B45309;">Name typed by host, NOT verified</span>';

  const button = payload.adminUrl
    ? `<tr><td style="padding:4px 24px 24px;">
        <a href="${esc(payload.adminUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0A0A0C;color:#C8FF2E;font-size:14px;font-weight:600;text-decoration:none;">Review &amp; pay this request</a>
      </td></tr>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F4F4F5;font-family:Helvetica,Arial,sans-serif;color:#18181B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E4E4E7;">
    <tr><td style="padding:24px 24px 8px;">
      <p style="margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6B7280;">Faded6 &middot; Payout request</p>
      <h1 style="margin:10px 0 4px;font-size:28px;line-height:1.2;">${esc(naira(payload.amountNgn))}</h1>
      <p style="margin:0;font-size:14px;color:#52525B;">requested by <strong>${esc(hostLabel)}</strong>${payload.hostName && payload.hostEmail ? ` (${esc(payload.hostEmail)})` : ''}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#71717A;">${esc(formatDate(payload.requestedAt))}</p>
    </td></tr>
    <tr><td style="padding:16px 24px;">
      <div style="padding:14px 16px;border-radius:8px;background:#F4F4F5;font-size:14px;line-height:1.7;">
        <div style="font-weight:600;">${esc(payload.bankName)}</div>
        <div style="font-family:'Courier New',monospace;font-size:18px;letter-spacing:.08em;">${esc(payload.accountNumber)}</div>
        <div>${esc(payload.accountName)}</div>
        <div style="font-size:12px;margin-top:4px;">${verification}</div>
      </div>
    </td></tr>
    ${warning}
    ${button}
    <tr><td style="padding:0 24px 24px;">
      <p style="margin:0;font-size:12px;color:#71717A;line-height:1.5;">Send the money from your Paystack dashboard or bank app, then mark the request as paid on the payout requests page.</p>
    </td></tr>
  </table>
</body></html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: payload.recipients, subject, html }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Resend rejected the payout alert', response.status, detail.slice(0, 300));
  }
}
