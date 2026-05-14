import type { IPlayerData } from '@/types/videoPlayer';

/**
 * 与 H5 竖滑邻格分工：
 * - **有邻格 peek**（移动端）：上一集、下一集由邻格 `VideoPlayer` 各自拉 `movie/episode`，此处只预拉 **下下一集**（例如当前第 2 集 → 预拉第 4 集），避免再向后打 5、6… 一堆接口。
 * - **无邻格 peek**（桌面）：邻格不挂播放器，此处预拉 **上一、下一、下下一** 共三环。
 */
export function getEpisodeIdsToPrewarm(
    episodes: IPlayerData['episodes'],
    centerIndex: number,
    viewerIsVip: boolean,
    hasNeighborPeekPlayers: boolean,
): number[] {
    const indices = hasNeighborPeekPlayers ? [centerIndex + 2] : [centerIndex - 1, centerIndex + 1, centerIndex + 2];
    const ids: number[] = [];
    for (const idx of indices) {
        if (idx < 0 || idx >= episodes.length) {
            continue;
        }
        const row = episodes[idx];
        if (!viewerIsVip && row.vip !== 0) {
            continue;
        }
        ids.push(row.id);
    }
    return [...new Set(ids)];
}
