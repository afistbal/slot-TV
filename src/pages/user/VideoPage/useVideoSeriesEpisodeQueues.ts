import { useEffect, useMemo } from 'react';
import type { IPlayerData } from '@/types/videoPlayer';
import {
    clearVideoEpisodeQueues,
    createQueueEpisodeFetcher,
    syncVideoPreloadWindow,
} from './videoEpisodeQueues';

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
) {
    const fetchOpts = useMemo(() => ({ viewerIsVip }), [viewerIsVip]);

    const fetchEpisodeDetail = useMemo(() => {
        if (movieId == null || !Number.isFinite(movieId)) {
            return undefined;
        }
        return createQueueEpisodeFetcher(movieId, fetchOpts);
    }, [movieId, fetchOpts]);

    useEffect(() => {
        if (movieId == null || !episodes?.length) {
            return;
        }
        void syncVideoPreloadWindow(movieId, episodes, activeIndex, fetchOpts);
    }, [movieId, episodes, activeIndex, fetchOpts]);

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
