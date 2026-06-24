/** 视频付费优惠 / 回归弹窗素材（替换同名 webp 即可） */
export const VIDEO_PAYWALL_PROMO_ASSET_DIR = 'src/assets/video-paywall-promo';

function assetUrl(file: string): string {
    return new URL(`../../assets/video-paywall-promo/${file}`, import.meta.url).href;
}

export const videoPaywallPromoAssets = {
    /** 弹窗卡片背景（橙黄渐变 + 底部黑色） */
    cardBg: assetUrl('bg.webp'),
    /** 顶部 VIP 装饰 */
    vipDeco: assetUrl('img.webp'),
    /** CTA 按钮光效 */
    ctaGlow: assetUrl('img1.webp'),
    /** 底部关闭按钮 */
    closeIcon: assetUrl('icon_close.webp'),
} as const;
