const FBP_STORAGE_KEY = 'fbp';
const FBC_STORAGE_KEY = 'fbc';

export type AnalyticsType = 'facebook' | 'tiktok' | '';

let analyticsType: AnalyticsType = '';

/** Pixel init 时写入；TikTok 配置下不传 FB log / pay/create 归因字段 */
export function setAnalyticsType(type: AnalyticsType): void {
    analyticsType = type;
}

export function isFacebookAnalytics(): boolean {
    return analyticsType === 'facebook';
}

function readCookie(name: string): string {
    if (typeof document === 'undefined') {
        return '';
    }
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function fbclidFromLocation(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    return new URLSearchParams(window.location.search).get('fbclid') ?? '';
}

/**
 * 从 cookie / URL 刷新 `_fbp`、`_fbc` 到 localStorage，供 `pay/create` 随单上报。
 * 进站、路由带 `fbclid`、或支付前均可调用。
 */
export function syncFbAttributionCache(): void {
    const fbp = readCookie('_fbp');
    if (fbp) {
        localStorage.setItem(FBP_STORAGE_KEY, fbp);
    }

    const fbcCookie = readCookie('_fbc');
    if (fbcCookie) {
        localStorage.setItem(FBC_STORAGE_KEY, fbcCookie);
        return;
    }

    const fbclid = fbclidFromLocation();
    if (!fbclid) {
        return;
    }

    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    localStorage.setItem(FBC_STORAGE_KEY, fbc);
    document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=7776000; SameSite=Lax`;
}

export function getStoredFbp(): string {
    return localStorage.getItem(FBP_STORAGE_KEY) ?? readCookie('_fbp') ?? '';
}

export function getStoredFbc(): string {
    return localStorage.getItem(FBC_STORAGE_KEY) ?? readCookie('_fbc') ?? '';
}

/** `pay/create` 请求体：Facebook 且有值才附带 `fbp` / `fbc` */
export function fbAttributionForPayCreate(): Record<string, string> {
    if (!isFacebookAnalytics()) {
        return {};
    }
    syncFbAttributionCache();
    const payload: Record<string, string> = {};
    const fbp = getStoredFbp();
    const fbc = getStoredFbc();
    if (fbp) {
        payload.fbp = fbp;
    }
    if (fbc) {
        payload.fbc = fbc;
    }
    return payload;
}

export type FbLogEventName = 'InitiateCheckout' | 'Purchase';
