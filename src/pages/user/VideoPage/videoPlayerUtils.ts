import { resolveMovieTagLocalLabel } from '@/lib/movieTagLabels';

function isOpaqueTagId(value: string) {
    return /^[a-f0-9]{10,}$/i.test(value);
}

function formatTagText(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (s) => s.toUpperCase());
}

export function getTagDisplayText(tag: {
    name: string;
    unique_id: string;
    local_label?: string;
}) {
    const localized = resolveMovieTagLocalLabel(tag);
    if (localized) {
        return localized;
    }
    const uid = String(tag.unique_id ?? '').trim();
    if (uid && !isOpaqueTagId(uid)) {
        return formatTagText(uid);
    }
    const name = String(tag.name ?? '').trim();
    if (name && !isOpaqueTagId(name)) {
        return name;
    }
    return name || uid || '-';
}

/** 侧栏收藏数展示：`0` 显示为 `1K`，避免 `0K` */
export function formatFavoriteCountK(favorite: number | undefined): string {
    const n = Number(favorite ?? 0);
    if (!Number.isFinite(n) || n <= 0) {
        return '1K';
    }
    return `${n}K`;
}

export function canNavigateBack() {
    if (typeof window === 'undefined') {
        return false;
    }
    const state = window.history.state as { idx?: unknown } | null;
    return typeof state?.idx === 'number' && state.idx > 0;
}

/** 整页刷新（F5）无用户手势：与直链冷启动一样走静音自动播 */
export function isPerformanceNavigationReload() {
    if (typeof performance === 'undefined') {
        return false;
    }
    const entry = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
    return entry?.type === 'reload';
}
