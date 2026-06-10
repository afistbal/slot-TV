import type { IPlayerData } from '@/types/videoPlayer';

/** v-demo batch 预加载窗口：上 1 下 2（第 1 集上 0）；非 VIP 遇 forward vip 档时 next 缩为 1 */
export function getVDemoPreloadWindowIndices(
    activeIndex: number,
    total: number,
    viewerIsVip: boolean,
    episodes: IPlayerData['episodes'],
): number[] {
    if (total <= 0) {
        return [];
    }

    const clampedIndex = Math.min(Math.max(0, activeIndex), total - 1);
    const prev = clampedIndex > 0 ? 1 : 0;
    let next = 2;

    if (
        !viewerIsVip &&
        (episodes[clampedIndex + 1]?.vip === 1 || episodes[clampedIndex + 2]?.vip === 1)
    ) {
        next = 1;
    }

    next = Math.min(next, total - 1 - clampedIndex);

    const indices: number[] = [];
    for (let i = clampedIndex - prev; i <= clampedIndex + next; i += 1) {
        if (i >= 0 && i < total) {
            indices.push(i);
        }
    }
    return indices;
}

export function getVDemoPreloadWindowRowIds(
    episodes: IPlayerData['episodes'],
    activeIndex: number,
    viewerIsVip: boolean,
): number[] {
    if (!episodes.length) {
        return [];
    }
    const indices = getVDemoPreloadWindowIndices(
        activeIndex,
        episodes.length,
        viewerIsVip,
        episodes,
    );
    return indices
        .map((idx) => episodes[idx]?.id)
        .filter((id): id is number => id != null && id > 0);
}
