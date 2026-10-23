const FROM_SOURCE_KEY = 'from_source';
/** 上次写入 `from_source` 时对应的 `localStorage.source`（用于检测 source 变更） */
const FROM_SOURCE_SOURCE_ANCHOR_KEY = 'from_source_source_anchor';
const SOURCE_KEY = 'source';
/**
 * 广告归因 query。推荐码 `ref` 有独立字段，不能混入 `from_source`。
 * search 优先；hash 路由带 ? 时取 hash 段。
 */
function attributionQuery(rawQuery: string): string {
    const params = new URLSearchParams(rawQuery);
    params.delete('ref');
    return params.toString();
}

function queryStringFromLocation(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const search = window.location.search;
    if (search.startsWith('?') && search.length > 1) {
        return attributionQuery(search.slice(1));
    }
    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    return attributionQuery(hashQuery.trim());
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

function urlContainsFacebook(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const haystack = `${window.location.href}\n${queryStringFromLocation()}`.toLowerCase();
    return haystack.includes('fb');
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
            && urlContainsFacebook();

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
 * - `from_source` 首触写入；source 变为 A100* 且 URL 含 Facebook 标记时可覆盖
 */
export function syncAdAttributionCache(): void {
    syncFromSource();
}

export function getStoredFromSource(): string {
    try {
        const stored = localStorage.getItem(FROM_SOURCE_KEY)?.trim() ?? '';
        if (!stored) return '';

        const sanitized = attributionQuery(stored);
        if (sanitized !== stored) {
            if (sanitized) {
                localStorage.setItem(FROM_SOURCE_KEY, sanitized);
            } else {
                localStorage.removeItem(FROM_SOURCE_KEY);
            }
        }
        return sanitized;
    } catch {
        return '';
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
