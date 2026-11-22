declare module '@paystack/inline-js' {
  export interface PaystackCustomField {
    display_name: string;
    variable_name: string;
    value: string;
  }

  export interface PaystackMetadata {
    custom_fields?: PaystackCustomField[];
    [key: string]: unknown;
  }

  export interface PaystackTransaction {
    id: number;
    reference: string;
    message: string;
  }

  export interface PaystackNewTransactionOptions {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    reference?: string;
    metadata?: PaystackMetadata;
    channels?: string[];
    onSuccess?: (transaction: PaystackTransaction) => void;
    onCancel?: () => void;
    onLoad?: (response: unknown) => void;
    onError?: (error: unknown) => void;
  }

  export default class PaystackPop {
    constructor();
    newTransaction(options: PaystackNewTransactionOptions): PaystackTransaction;
    cancel(): void;
  }
}
