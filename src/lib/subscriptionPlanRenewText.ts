import type { IntlShape } from 'react-intl';

type SubscriptionPlanRenewInput = {
    price: string;
    renewal_price: string;
    /** product `name`, e.g. weekly | monthly | yearly */
    planName: string;
};

const INTRO_SUBTITLE_IDS: Record<string, string> = {
    weekly: 'shopping_vip_weekly_subtitle',
    monthly: 'shopping_vip_monthly_subtitle',
    yearly: 'shopping_vip_yearly_subtitle',
    daily: 'shopping_vip_daily_subtitle',
};

/** 接口 `name` 与展示用 key 不一致时的别名 */
const PLAN_PERIOD_ALIASES: Record<string, keyof typeof INTRO_SUBTITLE_IDS> = {
    annual: 'yearly',
    annually: 'yearly',
    annum: 'yearly',
    week: 'weekly',
    month: 'monthly',
    year: 'yearly',
    day: 'daily',
};

function normalizePlanNameKey(planName: string): string {
    return String(planName ?? '')
        .toLowerCase()
        .replace(/_subscription$/, '')
        .replace(/_plan$/, '')
        .replace(/_vip$/, '')
        .trim();
}

/** 从商品 `name`（weekly / monthly / yearly / daily / annual 等）解析周期 */
export function resolveSubscriptionPeriod(
    planName: string,
): keyof typeof INTRO_SUBTITLE_IDS | null {
    const key = normalizePlanNameKey(planName);
    if (!key) {
        return null;
    }

    const alias = PLAN_PERIOD_ALIASES[key];
    if (alias) {
        return alias;
    }

    if (key.includes('week') || key === 'weekly') {
        return 'weekly';
    }
    if (key.includes('month') || key === 'monthly') {
        return 'monthly';
    }
    if (key.includes('year') || key === 'yearly') {
        return 'yearly';
    }
    if ((key.includes('day') || key === 'daily') && !key.includes('week')) {
        return 'daily';
    }

    return INTRO_SUBTITLE_IDS[key as keyof typeof INTRO_SUBTITLE_IDS]
        ? (key as keyof typeof INTRO_SUBTITLE_IDS)
        : null;
}

export function isWeeklySubscriptionPlan(planName: string): boolean {
    return resolveSubscriptionPeriod(planName) === 'weekly';
}

function formatIntroSubtitle(
    intl: IntlShape,
    period: keyof typeof INTRO_SUBTITLE_IDS,
    price: string,
    renewal_price: string,
): string {
    return intl.formatMessage(
        { id: INTRO_SUBTITLE_IDS[period] },
        {
            price1: `$${price}`,
            price2: `$${renewal_price}`,
        },
    );
}

/**
 * VIP 套餐续费说明：能识别周期时一律用「首週/首月/首年/首日 …」模板，
 * 与首期价是否等于续费价无关（年卡不再落到 shopping_auto_renew_short）。
 */
export function formatSubscriptionPlanRenewText(
    intl: IntlShape,
    { price, renewal_price, planName }: SubscriptionPlanRenewInput,
): string {
    const renewal = renewal_price || price;
    const period = resolveSubscriptionPeriod(planName);

    if (period) {
        return formatIntroSubtitle(intl, period, price, renewal);
    }

    return intl.formatMessage(
        { id: 'shopping_vip_weekly_subtitle' },
        {
            price1: `$${price}`,
            price2: `$${renewal}`,
        },
    );
}
