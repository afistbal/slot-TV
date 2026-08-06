export type TikTokMonetizationMode = 'iaa' | 'iap';

const TIKTOK_REWARDED_AD_UNIT_ID_STORAGE_KEY = 'tiktok_rewarded_ad_unit_id';

function configuredDefaultRewardedAdUnitId(): string {
    return import.meta.env.VITE_TIKTOK_REWARDED_AD_UNIT_ID?.trim() ?? '';
}

let allowedRewardedAdUnitIds = new Set<string>(
    [configuredDefaultRewardedAdUnitId()].filter(Boolean),
);
let firstBackendRewardedAdUnitId = '';

function adUnitIdFromLocation(): string {
    if (typeof window === 'undefined') return '';

    const fromSearch = new URLSearchParams(window.location.search)
        .get('ad_unit_id')
        ?.trim();
    if (fromSearch) return fromSearch;

    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    return new URLSearchParams(hashQuery).get('ad_unit_id')?.trim() ?? '';
}

function getCachedRewardedAdUnitId(): string {
    if (typeof window === 'undefined') return '';
    try {
        return window.localStorage
            .getItem(TIKTOK_REWARDED_AD_UNIT_ID_STORAGE_KEY)
            ?.trim() ?? '';
    } catch {
        return '';
    }
}

function cacheRewardedAdUnitId(adUnitId: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(TIKTOK_REWARDED_AD_UNIT_ID_STORAGE_KEY, adUnitId);
    } catch {
        // TikTok WebView may deny storage in restricted browsing modes.
    }
}

/**
 * Replaces the client-side allowlist with the enabled ad unit IDs returned by
 * our backend. The configured default is always retained as a safe fallback.
 */
export function setTikTokRewardedAdUnitIds(adUnitIds: readonly string[]): void {
    const defaultAdUnitId = configuredDefaultRewardedAdUnitId();
    const normalizedAdUnitIds = adUnitIds.map((id) => id.trim()).filter(Boolean);
    firstBackendRewardedAdUnitId = normalizedAdUnitIds[0] ?? '';
    allowedRewardedAdUnitIds = new Set(
        [defaultAdUnitId, ...normalizedAdUnitIds].filter(Boolean),
    );
}

/**
 * TikTok currently launches with rewarded ads only. Keep the existing IAP
 * implementation registered behind this switch because it may be enabled in
 * a later release.
 */
export function getTikTokMonetizationMode(): TikTokMonetizationMode {
    return import.meta.env.VITE_TIKTOK_MONETIZATION_MODE?.trim().toLowerCase() === 'iap'
        ? 'iap'
        : 'iaa';
}

export function isTikTokIapMode(): boolean {
    return getTikTokMonetizationMode() === 'iap';
}

export function getTikTokRewardedAdUnitId(): string {
    const defaultAdUnitId = configuredDefaultRewardedAdUnitId();
    const fallbackAdUnitId = defaultAdUnitId || firstBackendRewardedAdUnitId;
    const urlAdUnitId = adUnitIdFromLocation();

    if (urlAdUnitId) {
        if (allowedRewardedAdUnitIds.has(urlAdUnitId)) {
            cacheRewardedAdUnitId(urlAdUnitId);
            return urlAdUnitId;
        }
        return fallbackAdUnitId;
    }

    const cachedAdUnitId = getCachedRewardedAdUnitId();
    if (cachedAdUnitId && allowedRewardedAdUnitIds.has(cachedAdUnitId)) {
        return cachedAdUnitId;
    }

    return fallbackAdUnitId;
}
