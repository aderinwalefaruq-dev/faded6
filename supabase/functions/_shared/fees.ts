/**
 * Platform service fee: 5% of the ticket subtotal + a flat ₦175, charged once per PAID order.
 * Free orders (subtotal 0) pay no fee. Rounded to the nearest whole naira (halves round up).
 *
 * KEEP IDENTICAL with src/lib/fees.ts - this is the one that decides what is
 * actually charged; the page keeps a copy only for the price preview.
 */
export const SERVICE_FEE_PERCENT = 5;
export const SERVICE_FEE_FLAT_NGN = 175;

export function calculateServiceFee(subtotalNgn: number): number {
  if (!Number.isFinite(subtotalNgn) || subtotalNgn <= 0) return 0;
  const percentPart = Math.floor((subtotalNgn * SERVICE_FEE_PERCENT + 50) / 100);
  return percentPart + SERVICE_FEE_FLAT_NGN;
}
