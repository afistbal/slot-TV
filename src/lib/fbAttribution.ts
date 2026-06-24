const FBP_STORAGE_KEY = 'fbp';
const FBC_STORAGE_KEY = 'fbc';
const FBCLID_STORAGE_KEY = 'fbclid';

export type AnalyticsType = 'facebook' | 'tiktok' | '';

let analyticsType: AnalyticsType = '';

/** Pixel init 时写入；TikTok 配置下不传 FB log 归因字段 */
export function setAnalyticsType(type: AnalyticsType): void {
    analyticsType = type;
}

export function isFacebookAnalytics(): boolean {
    return analyticsType === 'facebook';
}

export function isTikTokAnalytics(): boolean {
    return analyticsType === 'tiktok';
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
    const fromSearch = new URLSearchParams(window.location.search).get('fbclid');
    if (fromSearch) {
        return fromSearch.trim();
    }
    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    return new URLSearchParams(hashQuery).get('fbclid')?.trim() ?? '';
}

/** URL 有 fbclid 时持久化；SPA 跳转后 URL 可能已无 fbclid */
function resolveFbclid(): string {
    const fromUrl = fbclidFromLocation();
    if (fromUrl) {
        try {
            localStorage.setItem(FBCLID_STORAGE_KEY, fromUrl);
        } catch {
            /* noop */
        }
        return fromUrl;
    }
    try {
        return localStorage.getItem(FBCLID_STORAGE_KEY) ?? '';
    } catch {
        return '';
    }
}

function fbcMatchesFbclid(fbc: string, fbclid: string): boolean {
    return Boolean(fbc && fbclid && fbc.endsWith(`.${fbclid}`));
}

function writeFbc(fbc: string): void {
    try {
        localStorage.setItem(FBC_STORAGE_KEY, fbc);
    } catch {
        /* noop */
    }
    document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=7776000; SameSite=Lax`;
}

/**
 * 从 cookie / URL 刷新 `_fbp`、`_fbc` 到 localStorage，供 `pay/create` 随单上报。
 * 进站、路由带 `fbclid`、或支付前均可调用。
 */
export function syncFbAttributionCache(): void {
    const fbp = readCookie('_fbp');
    if (fbp) {
        try {
            localStorage.setItem(FBP_STORAGE_KEY, fbp);
        } catch {
            /* noop */
        }
    }

    const fbclid = resolveFbclid();
    const fbcCookie = readCookie('_fbc');
    if (fbcCookie && (!fbclid || fbcMatchesFbclid(fbcCookie, fbclid))) {
        writeFbc(fbcCookie);
        return;
    }

    if (!fbclid) {
        return;
    }

    writeFbc(`fb.1.${Date.now()}.${fbclid}`);
}

export function getStoredFbp(): string {
    try {
        return localStorage.getItem(FBP_STORAGE_KEY) ?? readCookie('_fbp') ?? '';
    } catch {
        return readCookie('_fbp') ?? '';
    }
}

export function getStoredFbc(): string {
    try {
        return localStorage.getItem(FBC_STORAGE_KEY) ?? readCookie('_fbc') ?? '';
    } catch {
        return readCookie('_fbc') ?? '';
    }
}

/** `pay/create` 请求体：Facebook 渠道附带 fbp / fbc（与 fbq 归因一致） */
export function fbAttributionForPayCreate(): Record<string, string> {
    if (!isFacebookAnalytics()) {
        return {};
    }
    syncFbAttributionCache();
    const out: Record<string, string> = {};
    const fbp = getStoredFbp();
    const fbc = getStoredFbc();
    if (fbp) {
        out.fbp = fbp;
    }
    if (fbc) {
        out.fbc = fbc;
    }
    return out;
}

export type FbLogEventName = 'AddToCart' | 'InitiateCheckout' | 'Purchase';
