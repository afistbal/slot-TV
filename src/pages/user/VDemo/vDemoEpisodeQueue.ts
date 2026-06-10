/**
 * v-demo 预加载队列：当前集 ±1，batch 写入缓存后按 episode 排序映射为 Feed items。
 */
import type { DouyinFeedVideoItem } from '@/components/douyin-feed-player';
import type { IPlayerData } from '@/types/videoPlayer';
import {
    VIDEO_PLAYER_WINDOW_NEXT,
    VIDEO_PLAYER_WINDOW_PREV,
} from '@/pages/user/VideoPage/videoSeriesConstants';

import {
    fetchVDemoEpisodesBatch,
    getVDemoEpisodeDetail,
    getVDemoEpisodeVideoUrl,
} from './fetchVDemoEpisodesBatch';

export function getVDemoPreloadWindowIndices(activeIndex: number, total: number): number[] {
    const indices: number[] = [];
    for (
        let i = activeIndex - VIDEO_PLAYER_WINDOW_PREV;
        i <= activeIndex + VIDEO_PLAYER_WINDOW_NEXT;
        i += 1
    ) {
        if (i >= 0 && i < total) {
            indices.push(i);
        }
    }
    return indices;
}

export function buildVDemoFeedItems(
    episodes: IPlayerData['episodes'],
): DouyinFeedVideoItem[] {
    return episodes.map((row) => {
        const detail = getVDemoEpisodeDetail(row.id);
        return {
            id: row.id,
            url: getVDemoEpisodeVideoUrl(row.id),
            subtitle: detail?.subtitle ?? '',
        };
    });
}

/** 同步 active ±1 窗口：缺 media 的集走 batch */
export async function syncVDemoPreloadWindow(
    movieId: number,
    episodes: IPlayerData['episodes'],
    activeIndex: number,
): Promise<void> {
    if (!episodes.length) {
        return;
    }
    const clampedIndex = Math.min(Math.max(0, activeIndex), episodes.length - 1);
    const windowIndices = getVDemoPreloadWindowIndices(clampedIndex, episodes.length);
    const rowIds = windowIndices
        .map((idx) => episodes[idx]?.id)
        .filter((id): id is number => id != null && id > 0);
    if (!rowIds.length) {
        return;
    }
    await fetchVDemoEpisodesBatch(movieId, rowIds);
}
