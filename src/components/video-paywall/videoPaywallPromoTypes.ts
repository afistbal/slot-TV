export type VideoPaywallTier = 'weekly' | 'yearly';

export type VideoPaywallProduct = {
    id: number;
    name: string;
    type: number;
    price: string;
    renewal_price: string;
};

export type VideoPaywallActiveOffer = {
    productId: number;
    expiresAt: number;
};

export type VideoPromoPanelState = {
    weekly: VideoPaywallActiveOffer | null;
    yearly: VideoPaywallActiveOffer | null;
    selectedProductId: number | null;
};

export type VideoPaywallModalMode =
    | 'weekly-offer'
    | 'weekly-retention'
    | 'yearly-offer'
    | 'yearly-retention'
    | null;

export const VIDEO_PAYWALL_PROMO_DURATION_SEC = 30 * 60;

/** 本地开发：每次打开付费墙都弹周卡优惠，便于联调 */
export const VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY = false;

/** 本地开发：每次打开付费墙都弹周卡挽留，便于联调样式（调完改回 false） */
export const VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_WEEKLY_RETENTION = false;

/** 本地开发：每次打开付费墙都弹年卡优惠，便于联调样式（调完改回 false） */
export const VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_YEARLY = false;

/** 本地开发：每次打开付费墙都弹年卡挽留，便于联调样式（调完改回 false） */
export const VIDEO_PAYWALL_PROMO_DEBUG_ALWAYS_YEARLY_RETENTION = true;
