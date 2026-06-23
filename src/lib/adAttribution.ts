import { isTikTokAnalytics } from '@/lib/fbAttribution';

const FROM_SOURCE_KEY = 'from_source';
/** 上次写入 `from_source` 时对应的 `localStorage.source`（用于检测 source 变更） */
const FROM_SOURCE_SOURCE_ANCHOR_KEY = 'from_source_source_anchor';
const SOURCE_KEY = 'source';
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

function getStoredSourceAnchor(): string {
    try {
        return localStorage.getItem(FROM_SOURCE_SOURCE_ANCHOR_KEY)?.trim() ?? '';
    } catch {
        return '';
    }
}

function setStoredSourceAnchor(source: string): void {
    try {
        localStorage.setItem(FROM_SOURCE_SOURCE_ANCHOR_KEY, source);
    } catch {
        /* noop */
    }
}

/** URL `s` 优先，否则读 localStorage.source */
function resolveCurrentSource(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const fromUrl = new URLSearchParams(window.location.search).get('s')?.trim();
    if (fromUrl) {
        return fromUrl;
    }
    try {
        return localStorage.getItem(SOURCE_KEY)?.trim() ?? '';
    } catch {
        return '';
    }
}

function isA100CampaignSource(source: string): boolean {
    return /^A100/i.test(source);
}

function urlContainsFbOrTiktok(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const haystack = `${window.location.href}\n${queryStringFromLocation()}`.toLowerCase();
    return haystack.includes('fb') || haystack.includes('tiktok');
}

function syncFromSource(): void {
    const query = queryStringFromLocation();
    if (!query) {
        return;
    }

    try {
        const currentSource = resolveCurrentSource();
        const anchorSource = getStoredSourceAnchor();
        const existingFromSource = localStorage.getItem(FROM_SOURCE_KEY);
        const sourceChanged = currentSource !== '' && currentSource !== anchorSource;
        const shouldUpdateOnCampaign =
            sourceChanged
            && isA100CampaignSource(currentSource)
            && urlContainsFbOrTiktok();

        if (!existingFromSource) {
            localStorage.setItem(FROM_SOURCE_KEY, query);
            if (currentSource) {
                setStoredSourceAnchor(currentSource);
            }
            return;
        }

        if (shouldUpdateOnCampaign) {
            localStorage.setItem(FROM_SOURCE_KEY, query);
            setStoredSourceAnchor(currentSource);
        }
    } catch {
        /* noop */
    }
}

/**
 * 进站 / 路由变化：
 * - `from_source` 首触写入；source 变为 A100* 且 URL 含 fb/tiktok 时可覆盖
 * - `ttclid` 首触写入，不覆盖
 */
export function syncAdAttributionCache(): void {
    syncFromSource();

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
