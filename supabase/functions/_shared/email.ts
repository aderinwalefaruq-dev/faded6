import QRCode from 'npm:qrcode@1.5.4';

interface EmailTicket {
  ticket_code: string;
  tier_name: string;
  buyer_name: string;
}

interface EmailPayload {
  to: string;
  buyerName: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  reference: string;
  totalNgn: number;
  tickets: EmailTicket[];
}

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const naira = (value: number) => `\u20A6${value.toLocaleString('en-NG')}`;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(date);
}

export async function sendTicketEmail(payload: EmailPayload): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('TICKET_EMAIL_FROM') ?? 'Faded6 <tickets@faded6.app>';

  if (!apiKey) {
    console.log('RESEND_API_KEY not configured — ticket email skipped for', payload.reference);
    return;
  }

  const cards = await Promise.all(
    payload.tickets.map(async (ticket) => {
      const qr = await QRCode.toDataURL(ticket.ticket_code, {
        margin: 1,
        width: 240,
        color: { dark: '#0A0A0C', light: '#FFFFFF' },
      });
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2A2A33;border-radius:12px;margin-bottom:14px;background:#121216;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#C8FF2E;">${esc(ticket.tier_name)}</p>
              <p style="margin:0 0 14px;font-size:17px;font-weight:600;color:#F4F4F5;">${esc(ticket.buyer_name)}</p>
              <img src="${qr}" width="160" height="160" alt="Ticket QR code" style="display:block;border-radius:8px;background:#FFFFFF;" />
              <p style="margin:14px 0 0;font-family:'Courier New',monospace;font-size:14px;letter-spacing:.12em;color:#C8FF2E;">${esc(ticket.ticket_code)}</p>
            </td>
          </tr>
        </table>`;
    }),
  );

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#0A0A0C;font-family:Helvetica,Arial,sans-serif;color:#F4F4F5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#121216;border-radius:14px;border:1px solid #2A2A33;">
    <tr><td style="padding:28px 24px 8px;">
      <p style="margin:0;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#C8FF2E;">Faded6 &middot; Entry Pass</p>
      <h1 style="margin:12px 0 6px;font-size:24px;line-height:1.25;color:#F4F4F5;">${esc(payload.eventTitle)}</h1>
      <p style="margin:0;font-size:14px;color:#9CA3AF;">${formatDate(payload.eventDate)}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#9CA3AF;">${esc(payload.venue)}</p>
    </td></tr>
    <tr><td style="padding:20px 24px 4px;">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#F4F4F5;">Hi ${esc(payload.buyerName)}, your payment of <strong style="color:#C8FF2E;">${naira(payload.totalNgn)}</strong> is confirmed. Show the QR code below at the gate.</p>
      ${cards.join('')}
      <p style="margin:0 0 24px;font-size:12px;color:#6B7280;">Order reference: ${esc(payload.reference)}</p>
    </td></tr>
    <tr><td style="padding:0 24px 24px;">
      <p style="margin:0;font-size:11px;color:#6B7280;">Faded6 Ticket Platform &middot; Prices in Nigerian Naira</p>
    </td></tr>
  </table>
</body></html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: `Your Faded6 ticket for ${payload.eventTitle}`,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Resend rejected the ticket email', response.status, detail.slice(0, 300));
  }
}
