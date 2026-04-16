/** Safari：Apple Pay on the Web（最小声明，避免手写 session 时报 TS 错） */

interface ApplePayPaymentRequest {
    countryCode: string;
    currencyCode: string;
    merchantCapabilities: string[];
    supportedNetworks: string[];
    total: ApplePayLineItem;
    lineItems?: ApplePayLineItem[];
}

interface ApplePayLineItem {
    label: string;
    amount: string;
    type?: 'final' | 'pending';
    paymentTiming?: 'recurring' | 'deferred' | 'immediate';
    recurringPaymentStartDate?: Date;
    recurringPaymentIntervalUnit?: string;
    recurringPaymentIntervalCount?: number;
    recurringPaymentEndDate?: Date;
}

interface ApplePayValidateMerchantEvent extends Event {
    readonly validationURL: string;
}

interface ApplePayPaymentAuthorizedEvent extends Event {
    readonly payment: ApplePayPayment;
}

interface ApplePayPayment {
    token: ApplePayPaymentToken;
}

interface ApplePayPaymentToken {
    paymentMethod: {
        displayName?: string;
        network?: string;
        type?: string;
    };
    paymentData: {
        version?: string;
        data?: string;
        signature?: string;
        header?: {
            ephemeralPublicKey?: string;
            publicKeyHash?: string;
            transactionId?: string;
        };
    };
    transactionIdentifier?: string;
}

declare class ApplePaySession {
    static canMakePayments(): boolean;
    static supportsVersion(version: number): boolean;
    constructor(version: number, request: ApplePayPaymentRequest);
    onvalidatemerchant: ((event: ApplePayValidateMerchantEvent) => void) | null;
    onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null;
    oncancel: (() => void) | null;
    begin(): void;
    completeMerchantValidation(merchantSession: unknown): void;
    completePayment(status: number): void;
    abort(): void;
    static readonly STATUS_SUCCESS: number;
    static readonly STATUS_FAILURE: number;
}
