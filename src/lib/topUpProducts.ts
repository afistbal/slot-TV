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

const emptyMemberships: TopUpDisplayProduct[] = ['basic', 'standard', 'premium'].map((name, index) => ({
    name, id: -100 - index, type: 1, price: '0', coin: 0, freeExtra: 0,
    renewal_price: '0', preview: true, days: 0,
}));

export function membershipPeriod(product: TopUpDisplayProduct): 'monthly' | 'annual' {
    return product.period ?? (resolveSubscriptionPeriod(product.name) === 'yearly' ? 'annual' : 'monthly');
}

export function displayTopUpProducts(products: TopUpProduct[], type: number, period = 'monthly'): TopUpDisplayProduct[] {
    const live = products.filter((product) => product.type === type && product.id > 0)
        .filter((product) => type !== 1 || membershipPeriod(product) === period);
    if (live.length) {
        if (type === 2 || live.length >= 3) return live;
        // Keep all three membership rows visible; missing tiers show zero.
        return [...live, ...emptyMemberships.slice(live.length).map((product) => ({ ...product, period: period === 'annual' ? 'annual' as const : 'monthly' as const }))];
    }
    return type === 2 ? emptyCoinPacks : emptyMemberships.map((product) => ({ ...product, period: period === 'annual' ? 'annual' : 'monthly' }));
}

/** Reference tiers have no equivalent in a weekly plan; only match the exact tier. */
export function referenceMembershipProducts(products: TopUpProduct[], period: 'monthly' | 'annual'): TopUpDisplayProduct[] {
    return ['basic', 'standard', 'premium'].map((tier, index) => {
        const name = period === 'annual' ? `${tier}_annual` : tier;
        const live = products.find(product => product.type === 1 && product.id > 0 && product.name === name);
        return live ? { ...live, period } : {
            id: -200 - index - (period === 'annual' ? 3 : 0),
            type: 1, name, period, price: '0', renewal_price: '0', coin: 0, days: 0, preview: true,
        };
    });
}
