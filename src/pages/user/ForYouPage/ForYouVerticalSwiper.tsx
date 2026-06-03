import { useCallback, useEffect, useRef, useState } from 'react';

import { Swiper, SwiperSlide } from 'swiper/react';

import type { Swiper as SwiperClass } from 'swiper';

import 'swiper/css';

import { useLocation, useNavigate } from 'react-router';
import { FormattedMessage } from 'react-intl';

import Loader from '@/components/Loader';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { cn } from '@/lib/utils';
import { useMinWidth768 } from '@/hooks/useMinWidth768';

import { useRootStore } from '@/stores/root';

import { buildPlayerDataFromFeedItem } from './foryouFeedUtils';
import { abortForyouVideoLoad, ensureForyouMediaPreconnect } from './foryouFeedMedia';
import { useConfigStore } from '@/stores/config';

import { ForYouPlayer } from './ForYouPlayer';

import { markVideoSessionUserUnmuted } from '@/pages/user/VideoPage/videoSessionMute';

import { navigateFromForyouToVideo } from './foryouNavigateToVideo';

import { useForyouFeed } from './useForyouFeed';
import { useForyouVideoPreload } from './useForyouVideoPreload';
import {
    getForyouFeedProgressSec,
    setForyouFeedProgressSec,
} from './foryouFeedProgress';

import { isInForyouPlayerWindow } from './foryouConstants';
import { readVerticalPcKeyNavAction } from '@/pages/user/VideoPage/videoVerticalPcKeyNav';
import { bindVerticalPcWheelNav } from '@/pages/user/VideoPage/videoVerticalPcWheelNav';
import { canNavigateBack, isPerformanceNavigationReload } from '@/pages/user/VideoPage/videoPlayerUtils';

import './foryou-vertical.scss';

/**
 * PC 竖向切剧总开关（与 VideoVerticalSwiper 的 `PC_VERTICAL_EPISODE_NAV_ENABLED` 对齐）。
 * 开启：PC 仅滚轮切条（无鼠标拖拽竖滑）；关闭：PC 仅右侧箭头，禁止滚轮与拖拽。
 */
const FORYOU_PC_VERTICAL_NAV_ENABLED = true;



export default function ForYouVerticalSwiper() {
    const isDesktop = useMinWidth768();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const location = useLocation();
    /** 显式 state，或站内路由栈已有上一页（非整页刷新）：PC/H5 均可先试有声自动播 */
    const fromHomeVideoPlayback =
        Boolean(
            (location.state as { fromHomeVideoPlayback?: boolean } | null)?.fromHomeVideoPlayback,
        ) ||
        (typeof window !== 'undefined' &&
            canNavigateBack() &&
            !isPerformanceNavigationReload());

    const navigate = useNavigate();

    const fullscreenTargetRef = useRef<HTMLDivElement>(null);

    const legacyEpisodeAutoplayRef = useRef(false);
    /** F5 整页刷新后仅首条走静音冷启动；滑切后置 false（navigation.type 在整页会话内恒为 reload） */
    const feedColdAutoplayRef = useRef(
        typeof window !== 'undefined' && isPerformanceNavigationReload(),
    );

    const swiperRef = useRef<SwiperClass | null>(null);

    const wasRefreshingRef = useRef(false);

    const [activeIndex, setActiveIndex] = useState(0);
    /** 当前条已起播后再预拉后 2 条，避免首屏 3 路 mp4 并发 */
    const [anchorPlaybackReady, setAnchorPlaybackReady] = useState(false);
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;
    const listLengthRef = useRef(0);
    const prevListLengthRef = useRef(0);

    const videoResumeRef = useRef<HTMLVideoElement | null>(null);



    const {

        list,

        loading,

        loadError,

        refreshing,

        loadingMore,

        hasMore,

        loadMore,

        prefetchIfNearEnd,

        onActiveIndexChange,

        onSwiperTouchEnd,

    } = useForyouFeed(sessionBootstrapReady);

    useEffect(() => {
        setAnchorPlaybackReady(false);
    }, [activeIndex]);

    const handleAnchorPlaybackStarted = useCallback(() => {
        setAnchorPlaybackReady(true);
    }, []);

    useForyouVideoPreload(list, activeIndex, staticBase, anchorPlaybackReady);

    useEffect(() => {
        if (list.length <= prevListLengthRef.current) {
            prevListLengthRef.current = list.length;
            return;
        }
        if (activeIndex === prevListLengthRef.current - 1) {
            requestAnimationFrame(() => {
                swiperRef.current?.slideNext();
            });
        }
        prevListLengthRef.current = list.length;
    }, [list.length, activeIndex]);

    /** H5/PC：滑到倒数第 2 条起持续预拉下一页（loadingMore 结束后若仍在末段会重试） */
    useEffect(() => {
        if (loading || !list.length) {
            return;
        }
        prefetchIfNearEnd(activeIndex);
    }, [activeIndex, list.length, loading, loadingMore, prefetchIfNearEnd]);

    useEffect(() => {
        const swiper = swiperRef.current;
        if (!swiper) {
            return;
        }
        swiper.update();
    }, [list.length]);

    useEffect(() => {

        useRootStore.getState().setTheme('dark');

        return () => {

            useRootStore.getState().setTheme('light');

        };

    }, []);

    useEffect(() => {
        ensureForyouMediaPreconnect(staticBase);
    }, [staticBase]);



    useEffect(() => {

        if (wasRefreshingRef.current && !refreshing) {

            setActiveIndex(0);

            swiperRef.current?.slideTo(0, 0);

        }

        wasRefreshingRef.current = refreshing;

    }, [refreshing]);



    const activeItem = list[activeIndex];



    const saveProgressForItem = useCallback(
        (item: (typeof list)[number] | undefined, video: HTMLVideoElement | null) => {
            if (!item || !video) {
                return;
            }
            setForyouFeedProgressSec(item, video.currentTime, video.duration);
        },
        [],
    );

    const onSlideChangeStart = useCallback(
        (swiper: SwiperClass) => {
            feedColdAutoplayRef.current = false;

            const prevItem = list[swiper.previousIndex];
            saveProgressForItem(prevItem, videoResumeRef.current);
            abortForyouVideoLoad(videoResumeRef.current);
            videoResumeRef.current = null;

            const next = swiper.activeIndex;

            setActiveIndex(next);

            onActiveIndexChange(next);
        },
        [list, onActiveIndexChange, saveProgressForItem],
    );

    const handleFeedPlaybackProgress = useCallback(
        (currentTimeSec: number, durationSec: number) => {
            const item = list[activeIndex];
            if (!item) {
                return;
            }
            setForyouFeedProgressSec(item, currentTimeSec, durationSec);
        },
        [list, activeIndex],
    );

    useEffect(() => {
        return () => {
            saveProgressForItem(list[activeIndex], videoResumeRef.current);
        };
    }, [activeIndex, list, saveProgressForItem]);



    const handleWatchFullSeries = useCallback(() => {

        if (!activeItem) {

            return;

        }

        const v = videoResumeRef.current;

        const resume = v?.currentTime ?? 0;

        if (v && !v.muted) {

            markVideoSessionUserUnmuted();

        }

        navigateFromForyouToVideo(navigate, activeItem, resume);

    }, [activeItem, navigate]);

    const handleFeedPrev = useCallback(() => {
        const swiper = swiperRef.current;
        if (!swiper || activeIndex <= 0) {
            return;
        }
        swiper.slidePrev();
    }, [activeIndex]);

    const handleFeedNext = useCallback(() => {
        const swiper = swiperRef.current;
        if (!swiper) {
            return;
        }
        if (activeIndex < list.length - 1) {
            swiper.slideNext();
            return;
        }
        if (hasMore) {
            void loadMore();
        }
    }, [activeIndex, list.length, hasMore, loadMore]);

    /** PC：与 /video 一致，禁止滚轮/触控板竖滑切剧 */
    useEffect(() => {
        if (!isDesktop || FORYOU_PC_VERTICAL_NAV_ENABLED) {
            return;
        }
        const root = fullscreenTargetRef.current;
        if (!root) {
            return;
        }
        const blockWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        root.addEventListener('wheel', blockWheel, { passive: false });
        return () => root.removeEventListener('wheel', blockWheel);
    }, [isDesktop]);

    useEffect(() => {
        const swiper = swiperRef.current;
        if (!swiper) {
            return;
        }
        swiper.allowTouchMove = !isDesktop;
    }, [isDesktop, list.length]);

    listLengthRef.current = list.length;

    /** PC：滚轮一次手势最多 1 条（监听勿随 activeIndex 重绑，否则连跳） */
    useEffect(() => {
        if (!isDesktop || !FORYOU_PC_VERTICAL_NAV_ENABLED || !list.length) {
            return;
        }
        const el = fullscreenTargetRef.current;
        if (!el) {
            return;
        }
        return bindVerticalPcWheelNav(el, {
            onPrev: () => {
                const swiper = swiperRef.current;
                if (!swiper || activeIndexRef.current <= 0) {
                    return;
                }
                swiper.slidePrev();
            },
            onNext: () => {
                const swiper = swiperRef.current;
                const len = listLengthRef.current;
                const idx = activeIndexRef.current;
                if (!swiper) {
                    return;
                }
                if (idx < len - 1) {
                    swiper.slideNext();
                    return;
                }
                if (hasMore) {
                    void loadMore();
                }
            },
        });
    }, [isDesktop, list.length, hasMore, loadMore]);

    /** PC：↑/↓ 切上/下一条（与滚轮一致，无拖拽） */
    useEffect(() => {
        if (!isDesktop || !FORYOU_PC_VERTICAL_NAV_ENABLED) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            const action = readVerticalPcKeyNavAction(e);
            if (!action) {
                return;
            }
            e.preventDefault();
            if (action === 'prev') {
                handleFeedPrev();
            } else {
                handleFeedNext();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isDesktop, handleFeedPrev, handleFeedNext]);



    const pcTopNav = isDesktop ? (
        <div className="video-vertical-pc-topnav">
            <ReelShortTopNav leftAction="none" showSearch />
        </div>
    ) : null;

    if (loading) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                    <Loader color="light" />
                </div>
            </div>
        ) : (
            <div className="foryou-vertical foryou-vertical--fullscreen-boot">
                <Loader color="light" />
            </div>
        );
    }



    if (loadError) {
        const errBody = (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black p-6 text-center text-sm text-white/70">
                {loadError}
            </div>
        );
        return isDesktop ? (
            <div className="video-vertical-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                {errBody}
            </div>
        ) : (
            <div className="foryou-vertical foryou-vertical--fullscreen-boot">{errBody}</div>
        );
    }

    if (!list.length) {
        const emptyBody = (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black text-sm text-white/60">
                <FormattedMessage id="foryou_no_recommendations" />
            </div>
        );
        return isDesktop ? (
            <div className="video-vertical-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                {emptyBody}
            </div>
        ) : (
            <div className="foryou-vertical foryou-vertical--fullscreen-boot">{emptyBody}</div>
        );
    }



    const episodeCurrent = activeItem?.episode ?? 1;

    const episodeTotal = activeItem?.episodes ?? 0;



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
            {refreshing ? (

                <div className="foryou-vertical__edge-hint foryou-vertical__edge-hint--top" aria-live="polite">

                    <Loader color="light" />

                </div>

            ) : null}

            {loadingMore ? (

                <div className="foryou-vertical__edge-hint foryou-vertical__edge-hint--bottom" aria-live="polite">

                    <Loader color="light" />

                </div>

            ) : null}

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

                    speed={280}

                    resistanceRatio={0.55}

                    touchReleaseOnEdges={!isDesktop}

                    allowTouchMove={!isDesktop}

                    simulateTouch={!isDesktop}

                    noSwiping

                    noSwipingClass="swiper-no-swiping"

                    onSwiper={(swiper) => {

                        swiperRef.current = swiper;

                        swiper.allowTouchMove = !isDesktop;

                    }}

                    onSlideChangeTransitionStart={onSlideChangeStart}

                    onReachEnd={() => {
                        if (hasMore) {
                            void loadMore();
                        }
                    }}

                    onTouchEnd={!isDesktop ? onSwiperTouchEnd : undefined}

                >

                    {list.map((item, i) => {
                        const isActive = i === activeIndex;
                        const inPlayerWindow = isInForyouPlayerWindow(i, activeIndex);
                        /** 仍在邻条窗口内、仅 paused 的格：勿 abort 清源，避免上滑复用实例黑屏 */
                        const foryouKeepMediaOnPause = inPlayerWindow && !isActive;
                        /** 下 1/2 条邻格：metadata 预拉；上 1 条与隐藏 +3 不在此挂邻格 preload */
                        const foryouNeighborPreload =
                            inPlayerWindow && !isActive && i > activeIndex
                                ? ('metadata' as const)
                                : undefined;

                        return (

                            <SwiperSlide

                                key={`${item.id}-${item.ep_id}`}

                                className="relative h-full w-full bg-black"

                            >

                                <div className="foryou-slide-shell">

                                    {inPlayerWindow ? (

                                        <div
                                            className="foryou-player-mount"
                                            style={{
                                                visibility: isActive ? 'visible' : 'hidden',
                                                pointerEvents: isActive ? 'auto' : 'none',
                                            }}
                                        >

                                            <ForYouPlayer

                                                key={item.ep_id}

                                                id={item.ep_id}

                                                playbackPolicy={
                                                    isActive ? 'autoplay' : 'paused'
                                                }

                                                index={0}

                                                data={buildPlayerDataFromFeedItem(item)}

                                                feedItem={item}

                                                isForYouFeed

                                                feedResumeTimeSec={getForyouFeedProgressSec(item)}

                                                onFeedPlaybackProgress={handleFeedPlaybackProgress}

                                                feedEpisodeCurrent={episodeCurrent}

                                                feedEpisodeTotal={episodeTotal}

                                                hideCenterPlayUntilFirstPlay

                                                foryouNeighborPreload={foryouNeighborPreload}

                                                foryouKeepMediaOnPause={foryouKeepMediaOnPause}

                                                onWatchFullSeries={handleWatchFullSeries}

                                                onPlaybackStarted={
                                                    isActive ? handleAnchorPlaybackStarted : undefined
                                                }

                                                onVideoCanPlay={
                                                    isActive ? handleAnchorPlaybackStarted : undefined
                                                }

                                                feedHasPrev={activeIndex > 0}

                                                feedHasNext={activeIndex < list.length - 1 || hasMore}

                                                onFeedPrev={handleFeedPrev}

                                                onFeedNext={handleFeedNext}

                                                onVideoElementReady={
                                                    isActive
                                                        ? (el) => {
                                                              videoResumeRef.current = el;
                                                          }
                                                        : undefined
                                                }

                                                onSetEpisode={() => {}}

                                                fullscreenTargetRef={fullscreenTargetRef}

                                                shouldKeepFullscreen={false}

                                                onFullscreenPrefChange={() => {}}

                                                onEpisodeFullscreenReady={() => {}}

                                                shouldIgnoreFullscreenExit={() => false}

                                                fromHomeVideoPlayback={fromHomeVideoPlayback}

                                                feedColdAutoplayRef={feedColdAutoplayRef}

                                                legacyEpisodeAutoplayRef={legacyEpisodeAutoplayRef}

                                                pcDrawerPanel={null}

                                                onPcDrawerPanelChange={() => {}}

                                                pcDrawerEntered={false}

                                                onPcDrawerEnteredChange={() => {}}

                                                pcDrawerClosingRef={{ current: false }}

                                            />

                                        </div>

                                    ) : null}

                                </div>

                            </SwiperSlide>

                        );

                    })}

                </Swiper>

            </div>

            </div>

        </div>

    );

}

