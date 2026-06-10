import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import {
    DouyinFeedPlayer,
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
} from '@/components/douyin-feed-player';
import Loader from '@/components/Loader';
import { useConfigStore } from '@/stores/config';
import type { IPlayerData } from '@/types/videoPlayer';

import { clearVDemoEpisodeCache } from './fetchVDemoEpisodesBatch';
import { fetchVDemoMovieInfo } from './fetchVDemoMovieInfo';
import {
    buildVDemoFeedItems,
    syncVDemoPreloadWindow,
} from './vDemoEpisodeQueue';

import './v-demo.scss';

const DEFAULT_MOVIE_ID = 1488;

function resolveInitialEpisodeIndex(episodes: IPlayerData['episodes'], playEpisode?: number): number {
    if (!episodes.length) {
        return 0;
    }
    if (playEpisode != null && playEpisode > 0) {
        const idx = episodes.findIndex((row) => Number(row.episode) === Number(playEpisode));
        if (idx >= 0) {
            return idx;
        }
    }
    return 0;
}

/**
 * v-demo：实验壳 — 先 `movie/info`，再按 active±1 走 `movie/episodes/batch`，渲染 douyin-feed-player。
 */
export default function VDemoPage() {
    const params = useParams();
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const movieId = Number(params['id']) || DEFAULT_MOVIE_ID;

    const [episodes, setEpisodes] = useState<IPlayerData['episodes']>([]);
    const [items, setItems] = useState<DouyinFeedVideoItem[]>([]);
    const [initialIndex, setInitialIndex] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [prefetching, setPrefetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const episodesRef = useRef(episodes);
    episodesRef.current = episodes;
    const movieIdRef = useRef(movieId);
    movieIdRef.current = movieId;
    const activeIndexRef = useRef(0);
    const prefetchCountRef = useRef(0);

    const refreshItems = useCallback(() => {
        setItems(buildVDemoFeedItems(episodesRef.current));
    }, []);

    const syncWindowRef = useRef<(index: number) => Promise<void>>(async () => undefined);
    syncWindowRef.current = async (index: number) => {
        const list = episodesRef.current;
        if (!list.length) {
            return;
        }
        prefetchCountRef.current += 1;
        setPrefetching(true);
        try {
            await syncVDemoPreloadWindow(movieIdRef.current, list, index);
            refreshItems();
        } finally {
            prefetchCountRef.current -= 1;
            if (prefetchCountRef.current <= 0) {
                prefetchCountRef.current = 0;
                setPrefetching(false);
            }
        }
    };

    useEffect(() => {
        let cancelled = false;
        clearVDemoEpisodeCache();
        setLoading(true);
        setError(null);
        setEpisodes([]);
        setItems([]);
        (async () => {
            const result = await fetchVDemoMovieInfo(movieId);
            if (cancelled) {
                return;
            }
            if (!result.ok) {
                setError(result.message);
                setLoading(false);
                return;
            }

            const sortedEpisodes = result.data.episodes ?? [];
            const startIndex = resolveInitialEpisodeIndex(
                sortedEpisodes,
                Number((result.data.info as { play?: number }).play),
            );
            setEpisodes(sortedEpisodes);
            setInitialIndex(startIndex);
            setActiveIndex(startIndex);
            activeIndexRef.current = startIndex;
            episodesRef.current = sortedEpisodes;

            try {
                await syncVDemoPreloadWindow(movieId, sortedEpisodes, startIndex);
            } catch (e) {
                if (cancelled) {
                    return;
                }
                const message = e instanceof Error ? e.message : 'batch failed';
                setError(message);
                setLoading(false);
                return;
            }

            if (cancelled) {
                return;
            }
            setItems(buildVDemoFeedItems(sortedEpisodes));
            setLoading(false);
        })();

        return () => {
            cancelled = true;
            clearVDemoEpisodeCache();
        };
    }, [movieId]);

    const handleIndexChange = useCallback((index: number, _direction?: FeedNavigateDirection) => {
        activeIndexRef.current = index;
        setActiveIndex(index);
        void syncWindowRef.current(index);
    }, []);

    if (loading) {
        return (
            <div className="v-demo v-demo--state">
                <p className="v-demo__hint">Loading movie/info…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="v-demo v-demo--state">
                <p className="v-demo__hint v-demo__hint--error">{error}</p>
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="v-demo v-demo--state">
                <p className="v-demo__hint">No episodes in movie/info</p>
            </div>
        );
    }

    const activeHasUrl = Boolean(items[activeIndex]?.url?.trim());

    return (
        <div className="v-demo">
            {prefetching || !activeHasUrl ? (
                <div className="v-demo__loadmore-hint" aria-live="polite">
                    <Loader color="light" />
                </div>
            ) : null}
            <DouyinFeedPlayer
                items={items}
                mediaBaseUrl={staticBase}
                preloadNext
                initialIndex={initialIndex}
                onIndexChange={handleIndexChange}
            />
        </div>
    );
}
