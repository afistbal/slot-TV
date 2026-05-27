import type { IPlayerData } from '@/types/videoPlayer';

/** PC / H5 统一：仅预拉当前集的上一集、下一集 `movie/episode`（邻格） */
export function getEpisodeIdsToPrewarm(
    episodes: IPlayerData['episodes'],
    centerIndex: number,
    viewerIsVip: boolean,
): number[] {
    const indices = [centerIndex - 1, centerIndex + 1];
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
