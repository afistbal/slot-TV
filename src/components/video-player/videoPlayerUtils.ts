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

/** 侧栏互动数严格展示后端整数，不擅自追加 K 等单位。 */
export function formatSideActionCount(value: number | undefined): string {
    const n = Number(value ?? 0);
    return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : '0';
}

export function canNavigateBack() {
    if (typeof window === 'undefined') {
        return false;
    }
    const state = window.history.state as { idx?: unknown } | null;
    return typeof state?.idx === 'number' && state.idx > 0;
}

/** 本次**文档加载**是否为 F5/刷新（整页生命周期内不变；SPA 切路由不会变） */
export function isDocumentReload(): boolean {
    if (typeof performance === 'undefined') {
        return false;
    }
    const entry = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
    return entry?.type === 'reload';
}

/** `movie/episode` 的 lock 可能是 boolean / 0 / 1 */
export function isEpisodeDetailLocked(lock: unknown): boolean {
    return lock === true || lock === 1 || lock === '1';
}
