import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { resolveForyouIncomingResumeSec } from '@/constants/foryouRoute';
import { buildVDemoPath } from '@/constants/vDemoRoute';
import { type DouyinFeedVideoItem } from '@/components/douyin-feed-player';
// Legacy cold-unmute navigation type, currently disabled:
// import { type FeedNavigateDirection } from '@/components/douyin-feed-player';
import { writeMutedPreference } from '@/components/douyin-feed-player/controls/mutePreference';
import { unlockUserAudio } from '@/components/douyin-feed-player/feed/userGesturePlay';
import Loader from '@/components/Loader';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { useVideoPlayerDesktop } from '@/hooks/useVideoPlayerDesktop';
import { useConfigStore } from '@/stores/config';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import type { IPlayerData } from '@/types/videoPlayer';

import { fetchVDemoMovieInfo, type VDemoPlayerData } from './fetchVDemoMovieInfo';
/* Legacy cold-unmute policy imports, currently disabled:
import { applyForDemoMountMutePolicy } from '@/pages/user/ForDemo/forDemoApplyMountMutePolicy';
import {
    resolveForDemoMountAutoplayFlags,
    type ForDemoMountAutoplayFlags,
} from '@/pages/user/ForDemo/forDemoAutoplayPolicy';
import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';
*/

import {
    areVDemoFeedItemsEqual,
    buildVDemoFeedItems,
    syncVDemoOnActiveIndex,
} from './vDemoEpisodeQueue';
import { VDemoH5PlayerShell } from './VDemoH5PlayerShell';
import { VDemoPcPlayerShell } from './VDemoPcPlayerShell';
import { scheduleVDemoFeedScrollSettled } from './vDemoFeedScroll';

import '@/components/foryou-feed/foryou-vertical.scss';
import '@/styles/video-vertical.scss';
import './v-demo.scss';

const ReelShortTopNav = lazy(() =>
    import('@/components/ReelShortTopNav').then((mod) => ({ default: mod.ReelShortTopNav })),
);

const BOOT_LOADER_DELAY_MS = 100000;

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
    const isDesktop = useVideoPlayerDesktop();
    const location = useLocation();
    const params = useParams();
    const navigate = useNavigate();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const viewerIsVip = useUserStore((s) => s.isVIP());
    const movieId = Number(params['id']);
    const urlEpisode = parseRouteEpisodeParam(params['episode']);

    const [playerData, setPlayerData] = useState<VDemoPlayerData | null>(null);
    const [episodes, setEpisodes] = useState<IPlayerData['episodes']>([]);
    const [items, setItems] = useState<DouyinFeedVideoItem[]>([]);
    const [initialIndex, setInitialIndex] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isFullscreenUi, setIsFullscreenUi] = useState(false);
    const fullscreenTargetRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [foryouResumeTimeSec, setForyouResumeTimeSec] = useState<number | undefined>();
    const [foryouResumeEpisodeRowId, setForyouResumeEpisodeRowId] = useState<number | undefined>();
    const showBootLoader = useDelayedVisible(loading, BOOT_LOADER_DELAY_MS);

    const episodesRef = useRef(episodes);
    episodesRef.current = episodes;
    const movieIdRef = useRef(movieId);
    movieIdRef.current = movieId;
    const viewerIsVipRef = useRef(viewerIsVip);
    viewerIsVipRef.current = viewerIsVip;
    const activeIndexRef = useRef(0);
    const foryouResumeResolvedRef = useRef(false);
    /** 仅首进读一次；切集 replace 导航会清空 location.state，不能放进 effect 依赖 */
    const mountLocationStateRef = useRef(location.state);
    const locationStateRef = useRef(location.state);
    locationStateRef.current = location.state;
    const scrollSettleCancelRef = useRef<(() => void) | null>(null);
    const scrollSettleGenRef = useRef(0);
    const playbackPolicyAppliedRef = useRef(false);
    if (!playbackPolicyAppliedRef.current) {
        playbackPolicyAppliedRef.current = true;
        writeMutedPreference(false);
        unlockUserAudio();
    }

    /* Legacy cold-unmute mount flow is preserved in
       ForDemo/forDemoAutoplayPolicy.ts / forDemoApplyMountMutePolicy.ts and disabled here:
       const mountFlagsRef = useRef<ForDemoMountAutoplayFlags | null>(null);
       if (mountFlagsRef.current == null) {
           const flags = resolveForDemoMountAutoplayFlags(location.state);
           mountFlagsRef.current = flags;
           useForDemoColdUnmuteStore.getState().initFromMount(flags);
           applyForDemoMountMutePolicy(flags);
       }
    */

    const refreshItemsIfChanged = useCallback(() => {
        setItems((prev) => {
            const next = buildVDemoFeedItems(episodesRef.current);
            return areVDemoFeedItemsEqual(prev, next) ? prev : next;
        });
    }, []);

    /** batch 回填等 DOM 更新推迟到 scroll-snap 落定，避免 iOS 卡在两屏中间 */
    const refreshItemsAfterScroll = useCallback(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                refreshItemsIfChanged();
            });
        });
    }, [refreshItemsIfChanged]);

    const syncWindowRef = useRef<(index: number) => void>(() => undefined);
    syncWindowRef.current = (index: number) => {
        const list = episodesRef.current;
        if (!list.length) {
            return;
        }

        void syncVDemoOnActiveIndex(movieIdRef.current, list, index, viewerIsVipRef.current).then(
            () => {
                refreshItemsAfterScroll();
            },
        );
    };

    useEffect(() => {
        useRootStore.getState().setTheme('dark');
        return () => {
            useRootStore.getState().setTheme('light');
        };
    }, []);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }

        let cancelled = false;
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
                    resolveForyouIncomingResumeSec(
                        movieId,
                        startRow.id,
                        mountLocationStateRef.current,
                    ),
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
            /* Legacy cold landing index, currently disabled:
               useForDemoColdUnmuteStore.getState().setColdLandingIndex(startIndex);
            */
            setItems(buildVDemoFeedItems(sortedEpisodes));
            setLoading(false);

            void syncVDemoOnActiveIndex(
                movieId,
                sortedEpisodes,
                startIndex,
                viewerIsVipRef.current,
            )
                .then(() => {
                    if (!cancelled) {
                        refreshItemsAfterScroll();
                    }
                })
                .catch((e) => {
                    if (cancelled) {
                        return;
                    }
                    console.warn(
                        '[v-demo] initial batch preload failed',
                        e instanceof Error ? e.message : e,
                    );
                });

        })();

        return () => {
            cancelled = true;
        };
    }, [movieId, sessionBootstrapReady]);

    const applyIndexSideEffects = useCallback(
        (index: number) => {
            setActiveIndex(index);
            const list = episodesRef.current;
            const row = list[index];
            if (row) {
                navigate(buildVDemoPath(movieIdRef.current, Number(row.episode)), {
                    replace: true,
                    state: locationStateRef.current,
                });
            }
            syncWindowRef.current(index);
        },
        [navigate],
    );

    const applyIndexSideEffectsRef = useRef(applyIndexSideEffects);
    applyIndexSideEffectsRef.current = applyIndexSideEffects;

    const handleIndexChange = useCallback(
        (index: number) => {
            activeIndexRef.current = index;

            /* Legacy overlay dismissal on index change, currently disabled:
               if (index !== useForDemoColdUnmuteStore.getState().coldLandingIndex) {
                   useForDemoColdUnmuteStore.getState().consumeColdAutoplay();
               }
            */

            if (isDesktop) {
                applyIndexSideEffectsRef.current(index);
                return;
            }

            scrollSettleCancelRef.current?.();
            scrollSettleGenRef.current += 1;
            const gen = scrollSettleGenRef.current;

            scrollSettleCancelRef.current = scheduleVDemoFeedScrollSettled(() => {
                scrollSettleCancelRef.current = null;
                if (gen !== scrollSettleGenRef.current) {
                    return;
                }
                applyIndexSideEffectsRef.current(index);
            });
        },
        [isDesktop],
    );

    const handleIndexChangeRef = useRef(handleIndexChange);
    handleIndexChangeRef.current = handleIndexChange;

    const onFeedIndexChange = useCallback((index: number) => {
        handleIndexChangeRef.current(index);
    }, []);

    useEffect(() => {
        return () => {
            scrollSettleCancelRef.current?.();
        };
    }, []);

    const pcTopNav = isDesktop ? (
        <div className="video-vertical-pc-topnav">
            <Suspense fallback={null}>
                <ReelShortTopNav leftAction="none" showSearch />
            </Suspense>
        </div>
    ) : null;

    if (loading) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell v-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                    {showBootLoader ? <Loader color="light" /> : null}
                </div>
            </div>
        ) : (
            <div className="v-demo v-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                {showBootLoader ? <Loader color="light" /> : null}
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
            initialIndex={initialIndex}
            foryouResumeTimeSec={foryouResumeTimeSec}
            foryouResumeEpisodeRowId={foryouResumeEpisodeRowId}
            fullscreenTargetRef={fullscreenTargetRef}
            isDesktop
            onFullscreenUiChange={setIsFullscreenUi}
            onIndexChange={onFeedIndexChange}
            onEpisodeUnlocked={refreshItemsIfChanged}
            onEpisodeDetailReady={refreshItemsIfChanged}
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
            fullscreenTargetRef={fullscreenTargetRef}
            onFullscreenUiChange={setIsFullscreenUi}
            onIndexChange={onFeedIndexChange}
            onEpisodeUnlocked={refreshItemsIfChanged}
            onEpisodeDetailReady={refreshItemsIfChanged}
        />
    );

    return isDesktop ? (
        <div className="video-vertical-pc-shell v-demo-pc-shell foryou-vertical-pc-shell">
            {!isFullscreenUi ? pcTopNav : null}
            <div className="v-demo v-demo--pc relative min-h-0 flex-1 overflow-hidden bg-black">
                <div
                    ref={fullscreenTargetRef}
                    className="video-fullscreen-target h-full w-full touch-none select-none"
                >
                    {playerBody}
                </div>
            </div>
        </div>
    ) : (
        <div
            ref={fullscreenTargetRef}
            className="v-demo v-demo--h5 foryou-vertical video-fullscreen-target fixed inset-0 z-0 overflow-hidden bg-black"
        >
            {playerBody}
        </div>
    );
}
