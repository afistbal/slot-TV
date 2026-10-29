/** Storefront prices and all Airwallex payment intents are denominated in US dollars. */
export const PAYMENT_CURRENCY = 'USD';

export function isPaymentCurrency(value: unknown): boolean {
    return typeof value === 'string' && value.trim().toUpperCase() === PAYMENT_CURRENCY;
}
