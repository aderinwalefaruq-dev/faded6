/**
 * Platform service fee: 5% of the ticket subtotal + a flat ₦175, charged once per PAID order.
 * Free orders (subtotal 0) pay no fee. Rounded to the nearest whole naira (halves round up).
 *
 * KEEP IDENTICAL with supabase/functions/_shared/fees.ts - the server one decides what is
 * actually charged; this copy only drives the price preview on the page.
 */
export const SERVICE_FEE_PERCENT = 5;
export const SERVICE_FEE_FLAT_NGN = 175;

export function calculateServiceFee(subtotalNgn: number): number {
  if (!Number.isFinite(subtotalNgn) || subtotalNgn <= 0) return 0;
  const percentPart = Math.floor((subtotalNgn * SERVICE_FEE_PERCENT + 50) / 100);
  return percentPart + SERVICE_FEE_FLAT_NGN;
}
