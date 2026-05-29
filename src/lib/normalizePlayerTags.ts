/** 统一解析 `foryou` / `movie/info` 等接口的 tags 数组 */
export type PlayerTagRow = {
    name: string;
    unique_id: string;
    local_label?: string;
};

function isOpaqueTagId(value: string) {
    return /^[a-f0-9]{10,}$/i.test(value);
}

function formatTagSlug(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (s) => s.toUpperCase());
}

/** 仅使用接口 tags 字段展示，不走 `movie/tag-labels` 二次匹配 */
export function getBackendTagDisplayText(tag: PlayerTagRow): string {
    const local = String(tag.local_label ?? '').trim();
    if (local) {
        return local;
    }
    const uid = String(tag.unique_id ?? '').trim();
    if (uid && !isOpaqueTagId(uid)) {
        return formatTagSlug(uid);
    }
    const name = String(tag.name ?? '').trim();
    if (name && !isOpaqueTagId(name)) {
        return name;
    }
    return uid || name || '-';
}

export function normalizePlayerTags(raw: unknown): PlayerTagRow[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out: PlayerTagRow[] = [];
    for (const item of raw) {
        if (typeof item === 'string') {
            const s = item.trim();
            if (s) {
                out.push({ name: s, unique_id: s });
            }
            continue;
        }
        if (item == null || typeof item !== 'object') {
            continue;
        }
        const row = item as Record<string, unknown>;
        const name = String(row['name'] ?? '').trim();
        const uniqueId = String(row['unique_id'] ?? row['uniqueId'] ?? '').trim();
        const localLabel = String(row['local_label'] ?? row['label'] ?? '').trim();
        if (!name && !uniqueId) {
            continue;
        }
        out.push({
            name: name || uniqueId,
            unique_id: uniqueId || name,
            ...(localLabel ? { local_label: localLabel } : {}),
        });
    }
    return out;
}
