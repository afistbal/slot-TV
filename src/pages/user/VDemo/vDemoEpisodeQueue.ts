/**
 * v-demo 编排：batch 驱动播放；movie/episode 由壳层 useVDemoActiveEpisode 拉取。
 */

import type { DouyinFeedVideoItem } from '@/components/douyin-feed-player';

import type { IPlayerData } from '@/types/videoPlayer';

import { getVDemoActiveEpisodeDetail } from './fetchVDemoEpisode';
import { fetchVDemoEpisodesBatch, getVDemoEpisodeDetail } from './fetchVDemoEpisodesBatch';
import { resolveVDemoRowLocked } from './vDemoUnlock';

import { getVDemoPreloadWindowRowIds } from './vDemoPreloadWindow';

/** 预加载窗口：movie/episodes/batch，决定 mp4/vtt 与可播态 */
export async function syncVDemoBatchPreload(
    movieId: number,
    episodes: IPlayerData['episodes'],
    activeIndex: number,
    viewerIsVip: boolean,
): Promise<void> {
    const rowIds = getVDemoPreloadWindowRowIds(episodes, activeIndex, viewerIsVip);
    if (!rowIds.length) {
        return;
    }

    await fetchVDemoEpisodesBatch(movieId, rowIds);
}

/** 滑集：batch 预加载；movie/episode 由壳层 useVDemoActiveEpisode 单独拉取 */
export async function syncVDemoOnActiveIndex(
    movieId: number,
    episodes: IPlayerData['episodes'],
    activeIndex: number,
    viewerIsVip: boolean,
): Promise<void> {
    await syncVDemoBatchPreload(movieId, episodes, activeIndex, viewerIsVip);
}

export function buildVDemoFeedItems(
    episodes: IPlayerData['episodes'],
): DouyinFeedVideoItem[] {
    return episodes.map((row) => {
        const locked = resolveVDemoRowLocked(row);
        const activeDetail = getVDemoActiveEpisodeDetail(row.id);
        const batchDetail = getVDemoEpisodeDetail(row.id);
        const video = String(activeDetail?.video ?? batchDetail?.video ?? '').trim();
        const subtitle = String(activeDetail?.subtitle ?? batchDetail?.subtitle ?? '').trim();

        return {
            id: row.id,
            url: locked ? '' : video,
            subtitle,
        };
    });
}

/** 滑动切条时避免无变化 rebuild items，打断 iOS scroll-snap */
export function areVDemoFeedItemsEqual(
    a: DouyinFeedVideoItem[],
    b: DouyinFeedVideoItem[],
): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        const left = a[i];
        const right = b[i];
        if (
            left.id !== right.id ||
            left.url !== right.url ||
            (left.subtitle ?? '') !== (right.subtitle ?? '')
        ) {
            return false;
        }
    }
    return true;
}
