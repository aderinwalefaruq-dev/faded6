import PaystackPop from '@paystack/inline-js';

export class PaymentCancelledError extends Error {
  constructor() {
    super('Payment window closed. No ticket was issued.');
    this.name = 'PaymentCancelledError';
  }
}

/** Public key from the build environment, if one was provided. */
export function envPaystackKey(): string {
  const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  return typeof key === 'string' ? key.trim() : '';
}

const KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9]+$/;

/** Paystack public keys always look like pk_test_… or pk_live_…. */
export function isValidPaystackKey(key: string): boolean {
  return KEY_PATTERN.test(key.trim());
}

export function isTestKey(key: string): boolean {
  return key.trim().startsWith('pk_test_');
}

interface PaystackPopupInstance {
  newTransaction: (options: Record<string, unknown>) => unknown;
}

type PaystackConstructor = new () => PaystackPopupInstance;

declare global {
  interface Window {
    PaystackPop?: PaystackConstructor;
  }
}

// Must be v2: the code below uses the v2 API (new PaystackPop().newTransaction). The v1 script
// exposes a different API (PaystackPop.setup) and would never open the popup.
const CDN_SRC = 'https://js.paystack.co/v2/inline.js';
let scriptPromise: Promise<void> | null = null;

/**
 * Guarantees the Paystack inline script is present. The npm package is bundled,
 * but if it ever fails at runtime we inject the official CDN script on demand
 * instead of leaving the buyer stuck.
 */
export function ensurePaystackLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CDN_SRC}"]`);

    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => {
        scriptPromise = null;
        reject(new Error('Could not load the Paystack checkout script.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = CDN_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the Paystack checkout script. Check your connection.'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export interface PaystackCheckoutInput {
  publicKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  buyerName: string;
  eventId: string;
  tierName: string;
}

/**
 * Opens the official Paystack inline modal. Paystack handles every Nigerian
 * channel — card, bank transfer, USSD and OPay — inside its own UI.
 */
export async function openPaystackCheckout(input: PaystackCheckoutInput): Promise<string> {
  const baseOptions = {
    key: input.publicKey,
    email: input.email,
    amount: input.amountKobo,
    currency: 'NGN',
    reference: input.reference,
    metadata: {
      custom_fields: [
        { display_name: 'Buyer Name', variable_name: 'buyer_name', value: input.buyerName },
        { display_name: 'Buyer Email', variable_name: 'buyer_email', value: input.email },
        { display_name: 'Event ID', variable_name: 'event_id', value: input.eventId },
        { display_name: 'Ticket Tier', variable_name: 'tier_name', value: input.tierName },
      ],
    },
  };

  return new Promise<string>((resolve, reject) => {
    const launch = (Ctor: PaystackConstructor) => {
      const popup = new Ctor();
      popup.newTransaction({
        ...baseOptions,
        onSuccess: (transaction: { reference?: string }) =>
          resolve(transaction?.reference || input.reference),
        onCancel: () => reject(new PaymentCancelledError()),
        onError: (error: { message?: string } | undefined) =>
          reject(new Error(error?.message || 'Paystack could not start the payment. Please try again.')),
      });
    };

    try {
      launch(PaystackPop as unknown as PaystackConstructor);
      return;
    } catch (bundledError) {
      console.warn('Bundled Paystack failed to open, falling back to the CDN script', bundledError);
    }

    ensurePaystackLoaded()
      .then(() => {
        const Ctor = window.PaystackPop;
        if (!Ctor) throw new Error('Paystack checkout is unavailable right now.');
        launch(Ctor);
      })
      .catch(reject);
  });
}
