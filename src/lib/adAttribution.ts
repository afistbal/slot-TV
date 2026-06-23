const FROM_SOURCE_KEY = 'from_source';
const TTCLID_KEY = 'ttclid';
/** 与 fbc 一致：cookie 兜底 90 天；主存 localStorage 不清除则一直在 */
const TTCLID_COOKIE_MAX_AGE = 7776000;

function readCookie(name: string): string {
    if (typeof document === 'undefined') {
        return '';
    }
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return match?.[1] ? decodeURIComponent(match[1]) : '';
}

/** 当前 URL 问号后整段 query（含 search；hash 路由带 ? 时取 hash 段） */
function queryStringFromLocation(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const search = window.location.search;
    if (search.startsWith('?') && search.length > 1) {
        return search.slice(1);
    }
    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    return hashQuery.trim();
}

function ttclidFromLocation(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const fromSearch = new URLSearchParams(window.location.search).get('ttclid');
    if (fromSearch) {
        return fromSearch.trim();
    }
    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    return new URLSearchParams(hashQuery).get('ttclid')?.trim() ?? '';
}

function writeTtclid(ttclid: string): void {
    try {
        localStorage.setItem(TTCLID_KEY, ttclid);
    } catch {
        /* noop */
    }
    document.cookie = `${TTCLID_KEY}=${encodeURIComponent(ttclid)}; path=/; max-age=${TTCLID_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * 进站 / 路由变化：首触写入 `from_source`、`ttclid`（均不覆盖）；URL 有 `ttclid` 时写入。
 */
export function syncAdAttributionCache(): void {
    const query = queryStringFromLocation();
    if (query) {
        try {
            if (!localStorage.getItem(FROM_SOURCE_KEY)) {
                localStorage.setItem(FROM_SOURCE_KEY, query);
            }
        } catch {
            /* noop */
        }
    }

    const ttclid = ttclidFromLocation();
    if (ttclid) {
        try {
            if (!localStorage.getItem(TTCLID_KEY)) {
                writeTtclid(ttclid);
            }
        } catch {
            /* noop */
        }
    }
}

export function getStoredFromSource(): string {
    try {
        return localStorage.getItem(FROM_SOURCE_KEY)?.trim() ?? '';
    } catch {
        return '';
    }
}

export function getStoredTtclid(): string {
    try {
        return localStorage.getItem(TTCLID_KEY)?.trim() ?? readCookie(TTCLID_KEY) ?? '';
    } catch {
        return readCookie(TTCLID_KEY) ?? '';
    }
}

/** 登录接口：有 `from_source` 就附带 */
export function fromSourceForLogin(): Record<string, string> {
    syncAdAttributionCache();
    const from_source = getStoredFromSource();
    if (from_source) {
        return { from_source };
    }
    return {};
}

import { isTikTokAnalytics } from '@/lib/fbAttribution';

/** `pay/create`：TikTok 渠道仅附带 `ttclid` */
export function ttclidForPayCreate(): Record<string, string> {
    if (!isTikTokAnalytics()) {
        return {};
    }
    syncAdAttributionCache();
    const ttclid = getStoredTtclid();
    if (ttclid) {
        return { ttclid };
    }
    return {};
}
