import { useEffect, useMemo } from 'react';
import type { IPlayerData } from '@/types/videoPlayer';
import {
    clearVideoEpisodeQueues,
    createQueueEpisodeFetcher,
    syncVideoPreloadWindow,
} from './videoEpisodeQueues';

export type UseVideoSeriesEpisodeQueuesOpts = {
    /** H5：当前条起播后再预拉邻集，且只拉 ±1（当前集由 VideoPlayer.loadData 负责） */
    anchorPlaybackReady?: boolean;
    /** H5：邻集逐条预拉，避免 3 路并发触发 UI 回闪 */
    sequentialNeighborPreload?: boolean;
};

/**
 * `/video` 双队列：
 * - 全量队列：本剧已拿到 mp4/vtt 的集（episodeDetailCache + fullQueueRowIds）
 * - 预加载队列：当前 active ±1，仅补缺失集数的 `movie/episode`
 */
export function useVideoSeriesEpisodeQueues(
    movieId: number | undefined,
    episodes: IPlayerData['episodes'] | undefined,
    activeIndex: number,
    viewerIsVip: boolean,
    opts: UseVideoSeriesEpisodeQueuesOpts = {},
) {
    const anchorPlaybackReady = opts.anchorPlaybackReady ?? true;
    const sequentialNeighborPreload = opts.sequentialNeighborPreload ?? false;

    const fetchOpts = useMemo(() => ({ viewerIsVip }), [viewerIsVip]);

    const fetchEpisodeDetail = useMemo(() => {
        if (movieId == null || !Number.isFinite(movieId)) {
            return undefined;
        }
        return createQueueEpisodeFetcher(movieId, fetchOpts);
    }, [movieId, fetchOpts]);

    /**
     * PC：静默预拉 active±1。
     * H5：邻格 VideoPlayer（paused loadData）已负责 episode 请求，此处不再重复打 API（避免滑切闪屏）。
     */
    useEffect(() => {
        if (sequentialNeighborPreload) {
            return;
        }
        if (!anchorPlaybackReady || movieId == null || !episodes?.length) {
            return;
        }
        void syncVideoPreloadWindow(movieId, episodes, activeIndex, fetchOpts, {
            neighborsOnly: true,
            sequential: false,
        });
    }, [movieId, episodes, activeIndex, fetchOpts, anchorPlaybackReady, sequentialNeighborPreload]);

    useEffect(() => {
        if (movieId == null) {
            return;
        }
        return () => {
            clearVideoEpisodeQueues(movieId);
        };
    }, [movieId]);

    return { fetchEpisodeDetail };
}
