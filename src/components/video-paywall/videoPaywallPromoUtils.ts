import type { VideoPaywallProduct, VideoPaywallTier } from '@/components/video-paywall/videoPaywallPromoTypes';

/** 首期价与续费价相同 → 过期回流用户「Special Price」 */
export function isSameRenewalPrice(product: VideoPaywallProduct): boolean {
    const price = Number.parseFloat(product.price);
    const renewal = Number.parseFloat(product.renewal_price);
    return Number.isFinite(price) && Number.isFinite(renewal) && price === renewal;
}

export function computePerDayPrice(price: string, tier: VideoPaywallTier): string {
    const value = Number.parseFloat(price);
    if (!Number.isFinite(value) || value <= 0) {
        return '0.00';
    }
    const days = tier === 'weekly' ? 7 : 365;
    return (value / days).toFixed(2);
}

export function weeklyOfferTitleId(product: VideoPaywallProduct): string {
    return isSameRenewalPrice(product)
        ? 'video_promo_weekly_special_price_title'
        : 'video_promo_weekly_offer_title';
}
