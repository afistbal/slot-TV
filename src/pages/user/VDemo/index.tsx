import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { resolveForyouIncomingResumeSec } from '@/constants/foryouRoute';
import { buildVDemoPath } from '@/constants/vDemoRoute';
import { type DouyinFeedVideoItem, type FeedNavigateDirection } from '@/components/douyin-feed-player';
import Loader from '@/components/Loader';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useConfigStore } from '@/stores/config';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import type { IPlayerData } from '@/types/videoPlayer';

import { clearVDemoActiveEpisodeCache } from './fetchVDemoEpisode';
import { clearVDemoEpisodeCache } from './fetchVDemoEpisodesBatch';
import { fetchVDemoMovieInfo, type VDemoPlayerData } from './fetchVDemoMovieInfo';
import { applyForDemoMountMutePolicy } from '@/pages/user/ForDemo/forDemoApplyMountMutePolicy';
import {
    resolveForDemoMountAutoplayFlags,
    type ForDemoMountAutoplayFlags,
} from '@/pages/user/ForDemo/forDemoAutoplayPolicy';
import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';

import { buildVDemoFeedItems, syncVDemoOnActiveIndex } from './vDemoEpisodeQueue';
import { VDemoH5PlayerShell } from './VDemoH5PlayerShell';
import { VDemoPcPlayerShell } from './VDemoPcPlayerShell';

import '@/pages/user/ForYouPage/foryou-vertical.scss';
import '@/styles/video-vertical.scss';
import './v-demo.scss';

function parseRouteEpisodeParam(raw: string | undefined): number | undefined {
    if (raw == null || raw === '') {
        return undefined;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

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
 * v-demo：数据层 movie/info + batch + episode；播放层复用 for-demo 封装壳 + DouyinFeedPlayer。
 */
export default function VDemoPage() {
    const isDesktop = useMinWidth768();
    const location = useLocation();
    const params = useParams();
    const navigate = useNavigate();
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const viewerIsVip = useUserStore((s) => s.isVIP());
    const movieId = Number(params['id']);
    const urlEpisode = parseRouteEpisodeParam(params['episode']);

    const [playerData, setPlayerData] = useState<VDemoPlayerData | null>(null);
    const [episodes, setEpisodes] = useState<IPlayerData['episodes']>([]);
    const [items, setItems] = useState<DouyinFeedVideoItem[]>([]);
    const [initialIndex, setInitialIndex] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [prefetching, setPrefetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foryouResumeTimeSec, setForyouResumeTimeSec] = useState<number | undefined>();
    const [foryouResumeEpisodeRowId, setForyouResumeEpisodeRowId] = useState<number | undefined>();

    const episodesRef = useRef(episodes);
    episodesRef.current = episodes;
    const movieIdRef = useRef(movieId);
    movieIdRef.current = movieId;
    const viewerIsVipRef = useRef(viewerIsVip);
    viewerIsVipRef.current = viewerIsVip;
    const activeIndexRef = useRef(0);
    const prefetchCountRef = useRef(0);
    const foryouResumeResolvedRef = useRef(false);
    const mountFlagsRef = useRef<ForDemoMountAutoplayFlags | null>(null);
    if (mountFlagsRef.current == null) {
        const flags = resolveForDemoMountAutoplayFlags(location.state);
        mountFlagsRef.current = flags;
        useForDemoColdUnmuteStore.getState().initFromMount(flags);
        applyForDemoMountMutePolicy(flags);
    }

    const refreshItems = useCallback(() => {
        setItems(buildVDemoFeedItems(episodesRef.current));
    }, []);

    const syncWindowRef = useRef<(index: number) => void>(() => undefined);
    syncWindowRef.current = (index: number) => {
        const list = episodesRef.current;
        if (!list.length) {
            return;
        }

        refreshItems();

        prefetchCountRef.current += 1;
        setPrefetching(true);
        void syncVDemoOnActiveIndex(movieIdRef.current, list, index, viewerIsVipRef.current)
            .then(() => {
                refreshItems();
            })
            .finally(() => {
                prefetchCountRef.current -= 1;
                if (prefetchCountRef.current <= 0) {
                    prefetchCountRef.current = 0;
                    setPrefetching(false);
                }
            });
    };

    useEffect(() => {
        useRootStore.getState().setTheme('dark');
        return () => {
            useRootStore.getState().setTheme('light');
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        clearVDemoEpisodeCache();
        clearVDemoActiveEpisodeCache();
        foryouResumeResolvedRef.current = false;
        setForyouResumeTimeSec(undefined);
        setForyouResumeEpisodeRowId(undefined);
        setLoading(true);
        setError(null);
        setPlayerData(null);
        setEpisodes([]);
        setItems([]);

        if (!Number.isFinite(movieId) || movieId <= 0) {
            setError('Invalid movie id in URL');
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

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
            const infoPlay = Number(result.data.info.play);
            const startEpisodeNo = urlEpisode ?? (infoPlay > 0 ? infoPlay : 1);
            const startIndex = resolveInitialEpisodeIndex(sortedEpisodes, startEpisodeNo);
            const startRow = sortedEpisodes[startIndex];
            if (!foryouResumeResolvedRef.current && startRow != null) {
                setForyouResumeTimeSec(
                    resolveForyouIncomingResumeSec(movieId, startRow.id, location.state),
                );
                setForyouResumeEpisodeRowId(startRow.id);
                foryouResumeResolvedRef.current = true;
            }

            setPlayerData(result.data);
            setEpisodes(sortedEpisodes);
            setInitialIndex(startIndex);
            setActiveIndex(startIndex);
            activeIndexRef.current = startIndex;
            episodesRef.current = sortedEpisodes;

            try {
                await syncVDemoOnActiveIndex(
                    movieId,
                    sortedEpisodes,
                    startIndex,
                    viewerIsVipRef.current,
                );
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
            clearVDemoActiveEpisodeCache();
        };
    }, [location.state, movieId]);

    const handleIndexChange = useCallback(
        (index: number, _direction?: FeedNavigateDirection) => {
            activeIndexRef.current = index;
            setActiveIndex(index);
            if (index > 0) {
                useForDemoColdUnmuteStore.getState().consumeColdAutoplay();
            }

            const list = episodesRef.current;
            const row = list[index];
            if (row) {
                navigate(buildVDemoPath(movieIdRef.current, Number(row.episode)), { replace: true });
            }

            syncWindowRef.current(index);
        },
        [navigate],
    );

    const pcTopNav = isDesktop ? (
        <div className="video-vertical-pc-topnav">
            <ReelShortTopNav leftAction="none" showSearch />
        </div>
    ) : null;

    if (loading) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell v-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                    <Loader color="light" />
                </div>
            </div>
        ) : (
            <div className="v-demo v-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                <Loader color="light" />
            </div>
        );
    }

    if (error) {
        const errBody = (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black p-6 text-center text-sm text-white/70">
                {error}
            </div>
        );
        return isDesktop ? (
            <div className="video-vertical-pc-shell v-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                {errBody}
            </div>
        ) : (
            <div className="v-demo v-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                {errBody}
            </div>
        );
    }

    if (!items.length || !playerData) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell v-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black text-sm text-white/60">
                    No episodes in movie/info
                </div>
            </div>
        ) : (
            <div className="v-demo v-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                <p className="v-demo__hint">No episodes in movie/info</p>
            </div>
        );
    }

    const playerBody = isDesktop ? (
        <VDemoPcPlayerShell
            staticBase={staticBase}
            playerData={playerData}
            playerItems={items}
            activeIndex={activeIndex}
            foryouResumeTimeSec={foryouResumeTimeSec}
            foryouResumeEpisodeRowId={foryouResumeEpisodeRowId}
            onIndexChange={handleIndexChange}
            onEpisodeUnlocked={refreshItems}
        />
    ) : (
        <VDemoH5PlayerShell
            staticBase={staticBase}
            playerData={playerData}
            playerItems={items}
            activeIndex={activeIndex}
            initialIndex={initialIndex}
            foryouResumeTimeSec={foryouResumeTimeSec}
            foryouResumeEpisodeRowId={foryouResumeEpisodeRowId}
            onIndexChange={handleIndexChange}
            onEpisodeUnlocked={refreshItems}
        />
    );

    return isDesktop ? (
        <div className="video-vertical-pc-shell v-demo-pc-shell foryou-vertical-pc-shell">
            {pcTopNav}
            <div className="v-demo v-demo--pc relative min-h-0 flex-1 overflow-hidden bg-black">
                {prefetching ? (
                    <div className="v-demo__loadmore-hint" aria-live="polite">
                        <Loader color="light" />
                    </div>
                ) : null}
                <div className="video-fullscreen-target h-full w-full touch-none select-none">
                    {playerBody}
                </div>
            </div>
        </div>
    ) : (
        <div className="v-demo v-demo--h5 foryou-vertical fixed inset-0 z-0 overflow-hidden bg-black">
            {prefetching ? (
                <div className="v-demo__loadmore-hint" aria-live="polite">
                    <Loader color="light" />
                </div>
            ) : null}
            {playerBody}
        </div>
    );
}
