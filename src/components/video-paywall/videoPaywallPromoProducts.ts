import { resolveSubscriptionPeriod } from '@/lib/subscriptionPlanRenewText';
import type { VideoPaywallProduct, VideoPaywallTier } from '@/components/video-paywall/videoPaywallPromoTypes';

export function pickVideoPaywallSubscription(
    products: VideoPaywallProduct[],
    tier: VideoPaywallTier,
): VideoPaywallProduct | null {
    const subs = products.filter((p) => p.type === 1);
    return (
        subs.find((p) => resolveSubscriptionPeriod(p.name) === tier) ??
        subs.find((p) => p.name.toLowerCase().includes(tier === 'weekly' ? 'week' : 'year')) ??
        null
    );
}
