import { api, type TData } from '@/api';
import { useSearchStore } from '@/stores/search';

export type MovieTagLabelRow = {
    language: string;
    local_label: string;
    matched_unique_id: string;
    source_tag_name: string;
};

/** 展示文案：优先接口 `local_label`，否则退回 unique_id 格式化 */
export function tagRowDisplayLabel(row: TData): string {
    const local = String(row['local_label'] ?? '').trim();
    if (local) {
        return local;
    }
    return formatTagUniqueId(String(row['unique_id'] ?? ''));
}

export function formatTagUniqueId(uniqueId: string): string {
    return uniqueId
        .split('')
        .map((ch, k) => {
            if (k === 0) {
                return ch.toUpperCase();
            }
            if (ch === '_') {
                return ' ';
            }
            return ch;
        })
        .join('');
}

export function normalizeMovieTagLabels(rows: MovieTagLabelRow[]): TData[] {
    return rows.map((row) => ({
        name: row.source_tag_name,
        unique_id: row.matched_unique_id,
        local_label: row.local_label,
        language: row.language,
    }));
}

let movieTagLabelsInflight: Promise<void> | null = null;
let movieTagLabelsCachedLocale: string | null = null;

/** 会话内按语言缓存；`Accept-Language` 由 api 层从 localStorage locale 注入 */
export async function ensureMovieTagLabels(): Promise<void> {
    const locale = localStorage.getItem('locale') ?? 'en';
    const s = useSearchStore.getState();

    if (s.tags.length > 0 && movieTagLabelsCachedLocale === locale) {
        return;
    }

    if (movieTagLabelsCachedLocale !== locale) {
        s.setTags([]);
        movieTagLabelsCachedLocale = locale;
    }

    if (!movieTagLabelsInflight) {
        movieTagLabelsInflight = api<MovieTagLabelRow[]>('movie/tag-labels', { loading: false })
            .then((res) => {
                useSearchStore.getState().setTags(normalizeMovieTagLabels(res.d ?? []));
                movieTagLabelsCachedLocale = locale;
            })
            .finally(() => {
                movieTagLabelsInflight = null;
            });
    }
    await movieTagLabelsInflight;
}

export function resolveMovieTagLocalLabel(tag: {
    name?: string;
    unique_id?: string;
    local_label?: string;
}): string | null {
    const direct = String(tag.local_label ?? '').trim();
    if (direct) {
        return direct;
    }
    const tags = useSearchStore.getState().tags;
    const uid = String(tag.unique_id ?? '').trim();
    const name = String(tag.name ?? '').trim();
    const row =
        (uid ? tags.find((t) => (t['unique_id'] as string) === uid) : undefined) ??
        (name ? tags.find((t) => (t['name'] as string) === name) : undefined);
    if (row) {
        return tagRowDisplayLabel(row);
    }
    return null;
}

export function resolveTagDisplayLabel(
    tagName: string,
    tags: TData[],
    fallbackTagMessage: string,
): string {
    if (!tagName) {
        return '';
    }
    const row = tags.find((t) => (t['name'] as string) === tagName);
    if (row) {
        return tagRowDisplayLabel(row);
    }
    if (/^[a-f0-9]{10,}$/i.test(tagName)) {
        return fallbackTagMessage;
    }
    return tagName;
}

/** 订阅 `movie/tag-labels` 缓存；加载完成后标签展示会自动刷新 */
export function useMovieTagLabelsReady(): void {
    useSearchStore((s) => s.tags);
}
