import { resolveSubscriptionPeriod } from '@/lib/subscriptionPlanRenewText';

export type TopUpProduct = {
    id: number;
    type: number;
    name: string;
    price: string;
    renewal_price: string;
    coin?: number;
    bouns?: string;
};

export type TopUpDisplayProduct = TopUpProduct & {
    preview?: boolean;
    period?: 'monthly' | 'annual';
    days?: number;
    freeExtra?: number;
};

// Preserve the reference layout without inventing amounts or sellable products.
// Negative IDs must never reach pay/create.
const emptyCoinPacks: TopUpDisplayProduct[] = Array.from({ length: 4 }, (_, index) => ({
    id: -index - 1, type: 2, name: 'coins', price: '0',
    renewal_price: '0', coin: 0, bouns: '0', preview: true,
}));

export function membershipPeriod(product: TopUpDisplayProduct): 'monthly' | 'annual' {
    return product.period ?? (actualMembershipPeriod(product) === 'annual' ? 'annual' : 'monthly');
}

export function displayTopUpProducts(products: TopUpProduct[], type: number, period = 'monthly'): TopUpDisplayProduct[] {
    if (type === 1) return membershipDisplayRows(products, period as MembershipBillingPeriod);
    const live = products.filter(product => product.type === type && product.id > 0);
    return live.length ? live : type === 2 ? emptyCoinPacks : [];
}

export type MembershipBillingPeriod = 'daily' | 'weekly' | 'monthly' | 'annual' | 'other';

export function actualMembershipPeriod(product: TopUpProduct): MembershipBillingPeriod {
    if (product.name.endsWith('_annual')) return 'annual';
    if (/^(basic|standard|premium)$/.test(product.name)) return 'monthly';
    const period = resolveSubscriptionPeriod(product.name);
    if (period === 'yearly') return 'annual';
    if (period === 'daily' || period === 'weekly' || period === 'monthly') return period;
    return 'other';
}

/** Weekly subscriptions have been retired from the storefront. */
export function actualMembershipProducts(products: TopUpProduct[]): TopUpProduct[] {
    return products.filter(product => product.type === 1 && product.id > 0 && actualMembershipPeriod(product) !== 'weekly');
}

/** Fill each missing tier independently; placeholders are never purchasable. */
export function membershipDisplayRows(products: TopUpProduct[], period: MembershipBillingPeriod): TopUpDisplayProduct[] {
    const live = actualMembershipProducts(products).filter(product => actualMembershipPeriod(product) === period);
    if (period !== 'monthly' && period !== 'annual') return live;
    const slots = ['basic', 'standard', 'premium'].map((tier, index): TopUpDisplayProduct => {
        const name = period === 'annual' ? `${tier}_annual` : tier;
        return live.find(product => product.name === name) ?? {
            id: -200 - index - (period === 'annual' ? 3 : 0), type: 1, name, period,
            price: '0', renewal_price: '0', coin: 0, days: 0, freeExtra: 0, preview: true,
        };
    });
    return [...slots, ...live.filter(product => !slots.some(slot => slot.id === product.id))];
}
