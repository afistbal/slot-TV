import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { useLocation, useNavigate, useParams } from 'react-router';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlinePlayerData } from '@/mocks/videoOffline';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import Loader from '@/components/Loader';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { useConfigStore } from '@/stores/config';
import { cn } from '@/lib/utils';
import { VideoPlayer } from './VideoPlayer';
import { clearEpisodeDetailCache } from './episodeDetailCache';
import { clearAllVideoEpisodeQueues } from './videoEpisodeQueues';
import { clearEpisodePeekFrameCache } from './episodeFrameQueueStore';
import { resolveVideoListIndexFromUrlSegment } from './resolveVideoListIndexFromUrlSegment';
import { readVerticalPcKeyNavAction } from './videoVerticalPcKeyNav';
import { bindVerticalPcWheelNav } from './videoVerticalPcWheelNav';
import { isVideoSeriesColdAutoplay, resolveVideoMountAutoplayFlags } from './videoAutoplayPolicy';
import { episodeListLockedFromDetail } from './videoPlayerUtils';
import type { PcDrawerPanel } from './videoPlayerPcDrawerMotion';
import { abortVideoLoad, ensureVideoMediaPreconnect } from './videoFeedMedia';
import { isInVideoPlayerWindow } from './videoSeriesConstants';
import { useVideoSeriesEpisodeQueues } from './useVideoSeriesEpisodeQueues';
import { isVideoIosPlayback, kickVideoIosGestureAutoplay } from './videoIosPlayback';
import '@/pages/user/ForYouPage/foryou-vertical.scss';

const PC_VERTICAL_EPISODE_NAV_ENABLED = true;
const SWIPER_SLIDE_SPEED_MS = 280;

function shouldMountNeighborPeekPlayer(
    row: NonNullable<IPlayerData['episodes']>[number],
    viewerIsVip: boolean,
): boolean {
    if (viewerIsVip) {
        return true;
    }
    return row.vip === 0;
}

export default function VideoSeriesVerticalSwiper() {
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const mountAutoplayRef = useRef(resolveVideoMountAutoplayFlags(location.state));
    /** 站内点击进入 → 有声；F5 落页一次性冷启动 → 静音蒙层（对标 For You） */
    const fromHomeVideoPlayback = mountAutoplayRef.current.fromHomeVideoPlayback;

    const isDesktop = useMinWidth768();
    const viewerIsVip = useUserStore((s) => Boolean(s.signed && s.info?.['is_vip']));

    const fullscreenTargetRef = useRef<HTMLDivElement>(null);
    const swiperRef = useRef<SwiperClass | null>(null);
    const legacyEpisodeAutoplayRef = useRef(false);
    const neighborLegacyAutoplayRef = useRef(false);
    /** 竖滑：仅首进当前剧/首条为 true，滑切后置 false（对标 ForYou feedColdAutoplayRef） */
    const videoColdAutoplayRef = useRef(mountAutoplayRef.current.videoColdAutoplay);
    const videoResumeRef = useRef<HTMLVideoElement | null>(null);
    const activeIndexRef = useRef(0);
    const dataRef = useRef<IPlayerData | undefined>(undefined);
    const navigatingFromSwipeRef = useRef(false);
    /** 首屏 URL 对齐完成前勿用动画 slideTo，避免 PC 先闪滑一下 */
    const initialUrlAlignDoneRef = useRef(false);
    /** Swiper 程序式 slideTo（非用户滑）时跳过 transitionStart 副作用 */
    const suppressSlideTransitionRef = useRef(false);

    const [data, setData] = useState<IPlayerData>();
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [keepFullscreen, setKeepFullscreen] = useState(false);
    const suppressFullscreenExitUntilRef = useRef(0);
    const switchingEpisodeInFullscreenRef = useRef(false);
    const pcDrawerClosingRef = useRef(false);
    const [pcDrawerPanel, setPcDrawerPanel] = useState<PcDrawerPanel>(null);
    const [pcDrawerEntered, setPcDrawerEntered] = useState(false);

    activeIndexRef.current = activeIndex;
    dataRef.current = data;

    const pcDrawerProps = {
        pcDrawerPanel,
        onPcDrawerPanelChange: setPcDrawerPanel,
        pcDrawerEntered,
        onPcDrawerEnteredChange: setPcDrawerEntered,
        pcDrawerClosingRef,
    };

    const episodes = data?.episodes ?? [];

    const movieId = Number(params['id']);
    const { fetchEpisodeDetail } = useVideoSeriesEpisodeQueues(
        Number.isFinite(movieId) ? movieId : undefined,
        episodes,
        activeIndex,
        viewerIsVip,
    );

    useEffect(() => {
        ensureVideoMediaPreconnect(staticBase);
    }, [staticBase]);

    const syncEpisodeListLock = useCallback((ep: IPlayerEpisode, listIndex?: number) => {
        const locked = episodeListLockedFromDetail(ep.lock);
        setData((prev) => {
            if (!prev) {
                return prev;
            }
            let i =
                listIndex != null && listIndex >= 0 && listIndex < prev.episodes.length
                    ? listIndex
                    : -1;
            if (i < 0) {
                i = prev.episodes.findIndex((e) => e.id === ep.id);
            }
            if (i < 0) {
                i = prev.episodes.findIndex((e) => e.episode === ep.episode);
            }
            if (i < 0 || prev.episodes[i].locked === locked) {
                return prev;
            }
            const nextEpisodes = prev.episodes.slice();
            nextEpisodes[i] = { ...nextEpisodes[i], locked };
            return { ...prev, episodes: nextEpisodes };
        });
    }, []);

    const syncNavigateForIndex = useCallback(
        (listIndex: number) => {
            const d = dataRef.current;
            if (!d) {
                return;
            }
            const row = d.episodes[listIndex];
            const seg = row != null ? String(row.episode) : String(Math.max(1, listIndex + 1));
            navigate(`/video/${params['id']}/${seg}${location.search}`, {
                replace: true,
                state: location.state,
            });
        },
        [navigate, params, location.search, location.state],
    );

    const markFullscreenTransition = useCallback(() => {
        if (!keepFullscreen) {
            return;
        }
        switchingEpisodeInFullscreenRef.current = true;
        suppressFullscreenExitUntilRef.current = Date.now() + 1800;
    }, [keepFullscreen]);

    const handleEpisodeFullscreenReady = useCallback(() => {
        switchingEpisodeInFullscreenRef.current = false;
    }, []);

    const shouldIgnoreFullscreenExit = useCallback(
        () =>
            switchingEpisodeInFullscreenRef.current ||
            Date.now() <= suppressFullscreenExitUntilRef.current,
        [],
    );

    const goToEpisode = useCallback(
        (next: number, animate = true) => {
            const d = dataRef.current;
            if (!d) {
                return;
            }
            let idx = next;
            if (idx > d.episodes.length - 1) {
                idx = d.episodes.length - 1;
            }
            if (idx < 0) {
                idx = 0;
            }
            if (idx === activeIndexRef.current) {
                return;
            }
            markFullscreenTransition();
            legacyEpisodeAutoplayRef.current = true;
            videoColdAutoplayRef.current = false;
            abortVideoLoad(videoResumeRef.current);
            videoResumeRef.current = null;
            navigatingFromSwipeRef.current = true;
            setActiveIndex(idx);
            syncNavigateForIndex(idx);
            swiperRef.current?.slideTo(idx, animate ? SWIPER_SLIDE_SPEED_MS : 0);
        },
        [markFullscreenTransition, syncNavigateForIndex],
    );

    const handleSetEpisode = useCallback(
        (index: number) => {
            goToEpisode(index);
        },
        [goToEpisode],
    );

    const markVerticalSwipeAutoplayIntent = useCallback(() => {
        legacyEpisodeAutoplayRef.current = true;
    }, []);

    const onSlideChangeTransitionStart = useCallback(
        (swiper: SwiperClass) => {
            if (suppressSlideTransitionRef.current) {
                return;
            }
            if (swiper.activeIndex === swiper.previousIndex) {
                return;
            }
            videoColdAutoplayRef.current = false;
            abortVideoLoad(videoResumeRef.current);
            videoResumeRef.current = null;
            markVerticalSwipeAutoplayIntent();

            const next = swiper.activeIndex;
            navigatingFromSwipeRef.current = true;
            setActiveIndex(next);
            syncNavigateForIndex(next);

            if (!isDesktop && isVideoIosPlayback()) {
                requestAnimationFrame(() => {
                    kickVideoIosGestureAutoplay(videoResumeRef.current);
                });
            }
        },
        [isDesktop, markVerticalSwipeAutoplayIntent, syncNavigateForIndex],
    );

    const onSlideChangeTransitionEnd = useCallback(() => {
        navigatingFromSwipeRef.current = false;
    }, []);

    useEffect(() => {
        pcDrawerClosingRef.current = false;
        setPcDrawerPanel(null);
        setPcDrawerEntered(false);
    }, [params['id']]);

    useEffect(() => {
        clearEpisodeDetailCache();
        clearAllVideoEpisodeQueues();
        clearEpisodePeekFrameCache();
        videoColdAutoplayRef.current = isVideoSeriesColdAutoplay(fromHomeVideoPlayback, false);
        initialUrlAlignDoneRef.current = false;
        setActiveIndex(0);
    }, [params['id']]);

    async function loadMovieInfo() {
        if (skipRemoteApi) {
            const idx = resolveVideoListIndexFromUrlSegment(offlinePlayerData.episodes, params['episode']);
            activeIndexRef.current = idx;
            initialUrlAlignDoneRef.current = true;
            setActiveIndex(idx);
            setData(offlinePlayerData);
            setLoading(false);
            return;
        }
        const result = await api<IPlayerData>('movie/info', {
            data: { id: params['id'] },
            loading: false,
        });
        if (result.c !== 0) {
            setLoading(false);
            return;
        }
        const idx = resolveVideoListIndexFromUrlSegment(result.d.episodes, params['episode']);
        activeIndexRef.current = idx;
        initialUrlAlignDoneRef.current = true;
        setActiveIndex(idx);
        setData(result.d);
        setLoading(false);
    }

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        setLoading(true);
        void loadMovieInfo();
    }, [sessionBootstrapReady, params['id']]);

    /** URL 集数变化（浏览器后退 / 外链切集）；首屏已在 loadMovieInfo 对齐，禁止动画 jump */
    useEffect(() => {
        if (!data || loading || navigatingFromSwipeRef.current) {
            return;
        }
        const idx = resolveVideoListIndexFromUrlSegment(data.episodes, params['episode']);
        if (idx === activeIndexRef.current) {
            return;
        }
        if (!initialUrlAlignDoneRef.current) {
            initialUrlAlignDoneRef.current = true;
            activeIndexRef.current = idx;
            setActiveIndex(idx);
            suppressSlideTransitionRef.current = true;
            requestAnimationFrame(() => {
                swiperRef.current?.slideTo(idx, 0);
                requestAnimationFrame(() => {
                    suppressSlideTransitionRef.current = false;
                });
            });
            return;
        }
        setActiveIndex(idx);
        swiperRef.current?.slideTo(idx, SWIPER_SLIDE_SPEED_MS);
    }, [data, loading, params['episode']]);

    /** `/video/:id` 无第三段时规范到首集 */
    useEffect(() => {
        if (!data || loading) {
            return;
        }
        const raw = params['episode'];
        if (raw !== undefined && String(raw).trim() !== '') {
            return;
        }
        const first = data.episodes[0];
        const id = params['id'];
        if (!first || !id) {
            return;
        }
        navigate(`/video/${id}/${first.episode}${location.search}`, {
            replace: true,
            state: location.state,
        });
    }, [data, loading, params, navigate, location.search, location.state]);

    useEffect(() => {
        useRootStore.getState().setTheme('dark');
        return () => {
            useRootStore.getState().setTheme('light');
        };
    }, []);

    useEffect(() => {
        const swiper = swiperRef.current;
        if (!swiper) {
            return;
        }
        swiper.allowSlidePrev = activeIndex > 0;
        swiper.allowSlideNext = activeIndex < episodes.length - 1;
        swiper.allowTouchMove = !isDesktop;
    }, [activeIndex, episodes.length, isDesktop]);

    useEffect(() => {
        const swiper = swiperRef.current;
        if (!swiper) {
            return;
        }
        swiper.update();
    }, [episodes.length]);

    useEffect(() => {
        if (!PC_VERTICAL_EPISODE_NAV_ENABLED || !isDesktop || !data || loading) {
            return;
        }
        const el = fullscreenTargetRef.current;
        if (!el) {
            return;
        }
        return bindVerticalPcWheelNav(el, {
            shouldIgnore: (e) =>
                Boolean((e.target as Element | null)?.closest('[data-pc-episode-aside]')),
            onPrev: () => {
                swiperRef.current?.slidePrev();
            },
            onNext: () => {
                swiperRef.current?.slideNext();
            },
        });
    }, [isDesktop, data, loading]);

    useEffect(() => {
        if (!PC_VERTICAL_EPISODE_NAV_ENABLED || !isDesktop || !data || loading) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (pcDrawerPanel != null) {
                return;
            }
            const action = readVerticalPcKeyNavAction(e);
            if (!action) {
                return;
            }
            e.preventDefault();
            if (action === 'prev') {
                swiperRef.current?.slidePrev();
            } else {
                swiperRef.current?.slideNext();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isDesktop, data, loading, pcDrawerPanel]);

    const pcTopNav = isDesktop ? (
        <div className="video-vertical-pc-topnav">
            <ReelShortTopNav leftAction="none" showSearch />
        </div>
    ) : null;

    const renderEpisodeSlide = (episodeIndex: number) => {
        if (!data) {
            return <div className="h-full w-full bg-black" />;
        }

        const row = data.episodes[episodeIndex];
        if (!row) {
            return <div className="h-full w-full bg-black" />;
        }

        const isActive = episodeIndex === activeIndex;
        const inPlayerWindow = isInVideoPlayerWindow(episodeIndex, activeIndex);
        const isNeighbor = !isActive && Math.abs(episodeIndex - activeIndex) === 1;
        /** 仍在邻条窗口内、仅 paused 的格：勿 abort 清源，避免上滑复用实例黑屏 */
        const videoKeepMediaOnPause = inPlayerWindow && !isActive;
        /** 紧邻上下条 auto 预缓冲；再下 1 条 metadata，减轻滑切后首秒 rebuffer */
        const videoNeighborPreload =
            inPlayerWindow && !isActive
                ? episodeIndex === activeIndex + 1 || episodeIndex === activeIndex - 1
                    ? ('auto' as const)
                    : episodeIndex > activeIndex
                      ? ('metadata' as const)
                      : undefined
                : undefined;

        if (!inPlayerWindow) {
            return <div className="h-full w-full bg-black" />;
        }

        if (isNeighbor && !shouldMountNeighborPeekPlayer(row, viewerIsVip)) {
            return <div className="h-full w-full bg-black" />;
        }

        return (
            <div
                className="foryou-player-mount relative h-full w-full"
                style={{
                    visibility: isActive ? 'visible' : 'hidden',
                    pointerEvents: isActive ? 'auto' : 'none',
                }}
            >
                <VideoPlayer
                    key={row.id}
                    id={row.id}
                    index={episodeIndex}
                    data={data}
                    onEpisodeLockSync={syncEpisodeListLock}
                    onSetEpisode={handleSetEpisode}
                    fullscreenTargetRef={fullscreenTargetRef}
                    shouldKeepFullscreen={keepFullscreen}
                    onFullscreenPrefChange={setKeepFullscreen}
                    onEpisodeFullscreenReady={handleEpisodeFullscreenReady}
                    shouldIgnoreFullscreenExit={shouldIgnoreFullscreenExit}
                    fromHomeVideoPlayback={isActive ? fromHomeVideoPlayback : false}
                    legacyEpisodeAutoplayRef={
                        isActive ? legacyEpisodeAutoplayRef : neighborLegacyAutoplayRef
                    }
                    playbackPolicy={isActive ? 'autoplay' : 'paused'}
                    h5VerticalPlayback={!isDesktop}
                    videoKeepMediaOnPause={videoKeepMediaOnPause}
                    videoNeighborPreload={videoNeighborPreload}
                    videoColdAutoplayRef={isActive ? videoColdAutoplayRef : undefined}
                    onVideoElementReady={
                        isActive
                            ? (el) => {
                                  videoResumeRef.current = el;
                              }
                            : undefined
                    }
                    fetchEpisodeDetail={fetchEpisodeDetail}
                    {...pcDrawerProps}
                />
            </div>
        );
    };

    if (loading || !data) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <Loader color="light" />
                </div>
            </div>
        ) : (
            <div className="foryou-vertical foryou-vertical--fullscreen-boot">
                <Loader color="light" />
            </div>
        );
    }

    return (
        <div
            className={
                isDesktop
                    ? 'video-vertical-pc-shell foryou-vertical-pc-shell'
                    : 'foryou-vertical fixed inset-0 z-0 overflow-hidden bg-black'
            }
        >
            {pcTopNav}
            <div
                className={
                    isDesktop
                        ? 'foryou-vertical relative min-h-0 flex-1 overflow-hidden bg-black'
                        : 'h-full w-full overflow-hidden bg-black'
                }
            >
                <div
                    ref={fullscreenTargetRef}
                    className={cn(
                        'video-fullscreen-target h-full w-full',
                        isDesktop && 'touch-none select-none',
                    )}
                >
                    <Swiper
                        className="foryou-vertical__swiper h-full w-full"
                        direction="vertical"
                        slidesPerView={1}
                        initialSlide={activeIndex}
                        speed={SWIPER_SLIDE_SPEED_MS}
                        resistanceRatio={0.55}
                        touchReleaseOnEdges={!isDesktop}
                        allowTouchMove={!isDesktop}
                        simulateTouch={!isDesktop}
                        noSwiping
                        noSwipingClass="swiper-no-swiping"
                        onSwiper={(swiper) => {
                            swiperRef.current = swiper;
                            swiper.allowTouchMove = !isDesktop;
                            swiper.allowSlidePrev = activeIndex > 0;
                            swiper.allowSlideNext = activeIndex < episodes.length - 1;
                            if (swiper.activeIndex !== activeIndex) {
                                suppressSlideTransitionRef.current = true;
                                swiper.slideTo(activeIndex, 0);
                                requestAnimationFrame(() => {
                                    suppressSlideTransitionRef.current = false;
                                });
                            }
                        }}
                        onSlideChangeTransitionStart={onSlideChangeTransitionStart}
                        onSlideChangeTransitionEnd={onSlideChangeTransitionEnd}
                        onTouchStart={!isDesktop ? markVerticalSwipeAutoplayIntent : undefined}
                    >
                        {episodes.map((row, i) => (
                            <SwiperSlide
                                key={row.id}
                                className="relative h-full w-full bg-black"
                            >
                                <div className="foryou-slide-shell h-full w-full">
                                    {renderEpisodeSlide(i)}
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </div>
        </div>
    );
}
