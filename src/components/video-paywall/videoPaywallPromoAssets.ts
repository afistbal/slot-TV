/** 视频付费优惠 / 回归弹窗素材（替换同名 webp 即可） */
export const VIDEO_PAYWALL_PROMO_ASSET_DIR = 'src/assets/video-paywall-promo';

function assetUrl(file: string): string {
    return new URL(`../../assets/video-paywall-promo/${file}`, import.meta.url).href;
}

export const videoPaywallPromoAssets = {
    /** 周卡弹窗卡片背景（黑底 + 顶角渐变） */
    cardBg: assetUrl('bg.webp'),
    /** 周卡顶部蝴蝶结装饰 */
    weeklyRibbon: assetUrl('img1.webp'),
    /** 年卡顶部 VIP 装饰 */
    yearlyDeco: assetUrl('img.webp'),
    /** 底部关闭按钮 */
    closeIcon: assetUrl('icon_close.webp'),
} as const;
