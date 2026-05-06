import type { TData } from '@/api';

/**
 * 与 `POST /api/login/token` 请求体一致：客户端存 `localStorage.token`，形如 `22260|TncccsMT...`。
 * - **两段**：展示 **`|` 前**（如 `22260`）
 * - **三段及以上**：展示 **最后一段**（短可读 UID，兼容旧格式）
 */
export function parseCompositeUidForDisplay(composite: string): string {
    const parts = composite.split('|').map((p) => p.replace(/token$/i, '').trim());
    const nonempty = parts.filter(Boolean);
    if (nonempty.length === 0) {
        return composite.trim();
    }
    if (nonempty.length === 2) {
        return nonempty[0] ?? '';
    }
    if (nonempty.length >= 3) {
        return nonempty[nonempty.length - 1] ?? '';
    }
    return nonempty[0] ?? '';
}

/** @deprecated 使用 parseCompositeUidForDisplay */
export const parseCompositeUidTail = parseCompositeUidForDisplay;

/**
 * 仅有字符串时的解析（后台列表等）：无 `|` 则原样返回。
 */
export function formatUserUniqueIdForDisplay(raw: unknown): string {
    const s = String(raw ?? '').trim();
    if (!s || !s.includes('|')) {
        return s;
    }
    return parseCompositeUidForDisplay(s);
}

const DISPLAY_UID_KEYS = ['short_uid', 'short_id', 'display_uid', 'display_id', 'show_uid'] as const;

function getSessionTokenFromStorage(): string | undefined {
    if (typeof localStorage === 'undefined') {
        return undefined;
    }
    try {
        const t = localStorage.getItem('token');
        return typeof t === 'string' ? t.trim() : undefined;
    } catch {
        return undefined;
    }
}

/**
 * 顶栏 / 个人页：`POST api/login/token` 返回的 `d`（或 `d.info`）写入 `userStore` 后，
 * **优先展示其中的数字 `uid`**（如 `22667`）；再退回其它展示字段、`unique_id`，最后兼容旧版 composite token 串。
 */
export function getUserUidForDisplay(info?: TData | null): string {
    if (info) {
        const uidField = info['uid'];
        if (typeof uidField === 'number' && Number.isFinite(uidField)) {
            return String(uidField);
        }
        if (typeof uidField === 'string' && uidField.trim()) {
            const t = uidField.trim();
            return t.includes('|') ? parseCompositeUidForDisplay(t) : t;
        }

        for (const k of DISPLAY_UID_KEYS) {
            const v = info[k];
            if (typeof v === 'string' && v.trim()) {
                return v.trim();
            }
        }

        const uniqueId = info['unique_id'];
        if (typeof uniqueId === 'string' && uniqueId.trim()) {
            const t = uniqueId.trim();
            return t.includes('|') ? parseCompositeUidForDisplay(t) : t;
        }
    }

    const sessionToken = getSessionTokenFromStorage();
    if (sessionToken?.includes('|')) {
        return parseCompositeUidForDisplay(sessionToken);
    }

    return '';
}
