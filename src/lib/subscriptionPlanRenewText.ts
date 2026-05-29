import type { IntlShape } from 'react-intl';

type SubscriptionPlanRenewInput = {
    price: string;
    renewal_price: string;
    /** product `name`, e.g. weekly | monthly | yearly */
    planName: string;
};

function subscriptionPricesDiffer(price: string, renewalPrice: string): boolean {
    const p = parseFloat(price);
    const r = parseFloat(renewalPrice);
    if (!Number.isFinite(p) || !Number.isFinite(r)) {
        return price !== renewalPrice;
    }
    return p !== r;
}

const INTRO_SUBTITLE_IDS: Record<string, string> = {
    weekly: 'shopping_vip_weekly_subtitle',
    monthly: 'shopping_vip_monthly_subtitle',
    yearly: 'shopping_vip_yearly_subtitle',
};

/** VIP 套餐续费说明：首期价与续费价不同时展示「首X …，之後 …/週期」，相同时展示自动续订文案。 */
export function formatSubscriptionPlanRenewText(
    intl: IntlShape,
    { price, renewal_price, planName }: SubscriptionPlanRenewInput,
): string {
    if (!subscriptionPricesDiffer(price, renewal_price)) {
        return intl.formatMessage({ id: 'shopping_auto_renew_short' });
    }

    const subtitleId = INTRO_SUBTITLE_IDS[planName] ?? 'shopping_vip_weekly_subtitle';
    return intl.formatMessage(
        { id: subtitleId },
        {
            price1: `$${price}`,
            price2: `$${renewal_price}`,
        },
    );
}
