import type { IPlayerData } from '@/types/videoPlayer';

/**
 * 将 URL 第三段解析为 `episodes` 数组下标。
 * 优先按 `episode` 字段匹配（与 `/video/:id/10` = 第 10 集一致）；
 * 若无匹配则回退为「1-based 连续下标」（兼容旧链）。
 */
export function resolveVideoListIndexFromUrlSegment(
    episodes: IPlayerData['episodes'],
    raw: string | undefined,
): number {
    if (episodes.length === 0) {
        return 0;
    }
    if (raw === undefined || raw === '') {
        return 0;
    }
    const n = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
        return 0;
    }
    const byEpisodeField = episodes.findIndex((e) => e.episode === n);
    if (byEpisodeField >= 0) {
        return byEpisodeField;
    }
    const asOneBasedListPosition = n - 1;
    if (asOneBasedListPosition >= 0 && asOneBasedListPosition < episodes.length) {
        return asOneBasedListPosition;
    }
    return 0;
}
