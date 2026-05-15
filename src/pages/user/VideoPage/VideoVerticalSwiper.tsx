import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { FormattedMessage } from 'react-intl';
import { useLocation, useNavigate, useParams } from 'react-router';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlinePlayerData } from '@/mocks/videoOffline';
import type { IPlayerData } from '@/types/videoPlayer';
import Loader from '@/components/Loader';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { useConfigStore } from '@/stores/config';
import { VideoPlayer } from './VideoPlayer';
import {
    createVerticalFiniteSlideState,
    slideInit,
    slideReset,
    shouldBypassVerticalSlidePointer,
    slideTouchEnd,
    slideTouchMove,
    slideTouchStart,
    type VerticalFiniteSlideState,
} from './videoVerticalDouyinSlide';
import { clearEpisodeDetailCache, prewarmEpisodeDetail } from './episodeDetailCache';
import { clearEpisodePeekFrameCache } from './episodeFrameQueueStore';
import { EpisodeFrameQueueOverlay } from './EpisodeFrameQueueOverlay';
import { getEpisodeIdsToPrewarm } from './episodePrewarm';
import { resolveVideoListIndexFromUrlSegment } from './resolveVideoListIndexFromUrlSegment';
import { resolveVideoPosterUrl } from './videoPlayerShareUrl';
import { canNavigateBack, isPerformanceNavigationReload } from './videoPlayerUtils';

/** 非会员：邻格不挂播放器，避免邻格 `VideoPlayer` 再打一遍详情；主格/预拉仍会请求 `movie/episode`（含 auto_unlock） */
function shouldMountNeighborPeekPlayer(
    row: NonNullable<IPlayerData['episodes']>[number],
    viewerIsVip: boolean,
): boolean {
    if (viewerIsVip) {
        return true;
    }
    return row.vip === 0;
}

function isVipLockedEpisodeRow(row: { vip: number; locked: number }): boolean {
    return row.vip !== 0 && row.locked === 1;
}

export default function VideoVerticalSwiper() {
    const rootStore = useRootStore();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    /** 显式 `VIDEO_FROM_HOME_STATE`，或站内路由栈已有上一页（非整页刷新）：PC 可与 H5 一样先试有声自动播 */
    const fromHomeVideoPlayback =
        Boolean(
            (location.state as { fromHomeVideoPlayback?: boolean } | null)?.fromHomeVideoPlayback,
        ) ||
        (typeof window !== 'undefined' &&
            canNavigateBack() &&
            !isPerformanceNavigationReload());
    const outerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const slideStateRef = useRef<VerticalFiniteSlideState>(createVerticalFiniteSlideState(0));
    const legacyEpisodeAutoplayRef = useRef(false);
    const [data, setData] = useState<IPlayerData>();
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [keepFullscreen, setKeepFullscreen] = useState(false);
    const fullscreenTargetRef = useRef<HTMLDivElement>(null);
    const suppressFullscreenExitUntilRef = useRef(0);
    const switchingEpisodeInFullscreenRef = useRef(false);
    const [viewportH, setViewportH] = useState(0);
    const skipLayoutUrlSyncRef = useRef(false);
    const didInitialLayoutRef = useRef(false);
    const neighborLegacyAutoplayRef = useRef(false);
    const isDesktop = useMinWidth768();
    const configStore = useConfigStore();
    const staticBase = useMemo(() => String(configStore.config['static'] ?? ''), [configStore.config['static']]);
    const viewerIsVip = useUserStore((s) => Boolean(s.signed && s.info?.['is_vip']));
    /** 首帧调试队列仅管理员可见（与 `userStore.isAdmin` / `info.admin` 一致） */
    const showEpisodeFrameQueue = useUserStore((s) =>
        Boolean(s.signed && Number(s.info?.['admin'] ?? 0) > 0),
    );
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;
    const paramsRef = useRef(params);
    paramsRef.current = params;
    const locationRef = useRef(location);
    locationRef.current = location;
    const dataRef = useRef(data);
    dataRef.current = data;

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

    const syncNavigateForIndex = useCallback((listIndex: number) => {
        const p = paramsRef.current;
        const loc = locationRef.current;
        const row = dataRef.current?.episodes[listIndex];
        const seg = row != null ? String(row.episode) : String(Math.max(1, listIndex + 1));
        navigateRef.current(`/video/${p['id']}/${seg}${loc.search}`, {
            replace: true,
            state: loc.state,
        });
    }, []);

    /** 首屏 loading 时外层未挂载，空依赖会导致永远不测量 → viewportH 恒为 0 → 黑屏 */
    useLayoutEffect(() => {
        if (loading) {
            return;
        }
        const outer = outerRef.current;
        if (!outer) {
            return;
        }
        const ro = new ResizeObserver(() => {
            setViewportH(outer.clientHeight);
        });
        ro.observe(outer);
        setViewportH(outer.clientHeight);
        return () => {
            ro.disconnect();
        };
    }, [loading]);

    useLayoutEffect(() => {
        if (!data || loading) {
            return;
        }
        const el = listRef.current;
        const outer = outerRef.current;
        if (!el || !outer) {
            return;
        }
        const outerH = outer.clientHeight;
        if (outerH <= 0) {
            return;
        }
        if (skipLayoutUrlSyncRef.current) {
            slideStateRef.current.wrapper.height = outerH;
            if (didInitialLayoutRef.current) {
                /**
                 * 勿在此处同步把 skip 清 false：`flushSync` 触发的本 effect 会先于 `pointerup` 里的 `slideReset` 跑完，
                 * 紧接着若 `viewportH` 或路由 params 晚一拍更新，会走下方 `slideInit` 用旧 URL 覆盖 `localIndex`，
                 * 出现「数据已是上/下一集，列表 translate 仍像当前集」的假回弹。延到帧末再清 skip，与 douyin 先改 index 再 reset 列表的节奏对齐。
                 */
                requestAnimationFrame(() => {
                    skipLayoutUrlSyncRef.current = false;
                });
                return;
            }
            skipLayoutUrlSyncRef.current = false;
        }

        const index = resolveVideoListIndexFromUrlSegment(data.episodes, params['episode']);
        slideStateRef.current.localIndex = index;
        setViewportH(outerH);
        /** 勿在 `useLayoutEffect` 同步栈里调 `flushSync`（会触发「已在 rendering 中」警告）；微任务仍在 paint 前执行 */
        queueMicrotask(() => {
            const listEl = listRef.current;
            const outerEl = outerRef.current;
            if (listEl === null || outerEl === null) {
                return;
            }
            const h = outerEl.clientHeight;
            if (h <= 0) {
                return;
            }
            flushSync(() => {
                setCurrent(index);
            });
            slideInit(listEl, slideStateRef.current, h, data.episodes.length);
            setInitialized(true);
            didInitialLayoutRef.current = true;
        });
    }, [data, loading, params['episode'], viewportH]);

    useEffect(() => {
        const el = listRef.current;
        if (!el || !data) {
            return;
        }
        const onPointerDown = (e: PointerEvent) => {
            if ((e.target as Element | null)?.closest('[data-pc-episode-aside]')) {
                return;
            }
            if (shouldBypassVerticalSlidePointer(e.target)) {
                return;
            }
            /** 勿 `setPointerCapture`：会把 pointer 锁在 list 上，子层「取消静音」等收不到完整 click。竖滑靠冒泡到 list 的 move/up。 */
            legacyEpisodeAutoplayRef.current = true;
            slideTouchStart(e, el, slideStateRef.current);
        };
        const onPointerMove = (e: PointerEvent) => {
            slideTouchMove(e, el, slideStateRef.current, null, null);
        };
        const onPointerUp = (e: PointerEvent) => {
            slideTouchEnd(e, slideStateRef.current, null, null, null);
            const idx = slideStateRef.current.localIndex;
            markFullscreenTransition();
            skipLayoutUrlSyncRef.current = true;
            flushSync(() => {
                setCurrent(idx);
                syncNavigateForIndex(idx);
            });
            const list = listRef.current;
            const outer = outerRef.current;
            if (list !== null && outer !== null) {
                const outerH = outer.clientHeight;
                if (outerH > 0) {
                    slideStateRef.current.wrapper.height = outerH;
                    /** 与 `handleSetEpisode` / douyin `touchEnd` 一致：index 与 DOM 切片已更新后再 `slideInit`，避免仅靠 `slideReset` 时序与 URL 竞态 */
                    slideInit(list, slideStateRef.current, outerH, data.episodes.length);
                }
            }
            const listForReset = listRef.current;
            if (listForReset !== null) {
                slideReset(listForReset, slideStateRef.current);
            }
        };
        const opts: AddEventListenerOptions = { passive: false };
        el.addEventListener('pointerdown', onPointerDown, opts);
        el.addEventListener('pointermove', onPointerMove, opts);
        el.addEventListener('pointerup', onPointerUp, opts);
        el.addEventListener('pointercancel', onPointerUp, opts);
        return () => {
            el.removeEventListener('pointerdown', onPointerDown, opts);
            el.removeEventListener('pointermove', onPointerMove, opts);
            el.removeEventListener('pointerup', onPointerUp, opts);
            el.removeEventListener('pointercancel', onPointerUp, opts);
        };
    }, [data, syncNavigateForIndex, markFullscreenTransition]);

    const handleSetEpisode = useCallback(
        (index: number) => {
            const el = listRef.current;
            const outer = outerRef.current;
            if (el === null || outer === null || data === undefined) {
                return;
            }
            markFullscreenTransition();
            let next = index;
            if (next > data.episodes.length - 1) {
                next = data.episodes.length - 1;
            }
            if (next < 0) {
                next = 0;
            }
            slideStateRef.current.localIndex = next;
            flushSync(() => {
                setCurrent(next);
                syncNavigateForIndex(next);
            });
            slideInit(el, slideStateRef.current, outer.clientHeight, data.episodes.length);
            skipLayoutUrlSyncRef.current = true;
        },
        [data, markFullscreenTransition, syncNavigateForIndex],
    );

    /** PC 邻格占位：与 H5 邻格「有画面」一致，用剧封面打底（不挂整页 VideoPlayer，避免桌面侧栏重复） */
    const dramaPosterUrl = useMemo(
        () => (data ? resolveVideoPosterUrl(staticBase, data.info.image).trim() : ''),
        [data, staticBase],
    );

    /** PC：滚轮仅在剧集竖滑列表 `listRef` 上响应（与 douyin 全幅竖滑区一致），不经过管理浮层；阈值略大减少误切 */
    useEffect(() => {
        if (!isDesktop || !data || !initialized) {
            return;
        }
        const list = listRef.current;
        if (!list) {
            return;
        }
        let accY = 0;
        let cooldownUntil = 0;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        const TH = 140;
        const COOLDOWN_MS = 480;
        const IDLE_RESET_MS = 200;
        const onWheel = (e: WheelEvent) => {
            if (Date.now() < cooldownUntil) {
                return;
            }
            if ((e.target as Element | null)?.closest('[data-pc-episode-aside]')) {
                return;
            }
            if (idleTimer) {
                clearTimeout(idleTimer);
            }
            idleTimer = setTimeout(() => {
                accY = 0;
                idleTimer = null;
            }, IDLE_RESET_MS);
            accY += e.deltaY;
            if (accY > TH) {
                accY = 0;
                cooldownUntil = Date.now() + COOLDOWN_MS;
                if (current < data.episodes.length - 1) {
                    handleSetEpisode(current + 1);
                }
            } else if (accY < -TH) {
                accY = 0;
                cooldownUntil = Date.now() + COOLDOWN_MS;
                if (current > 0) {
                    handleSetEpisode(current - 1);
                }
            }
        };
        list.addEventListener('wheel', onWheel, { passive: true });
        return () => {
            list.removeEventListener('wheel', onWheel);
            if (idleTimer) {
                clearTimeout(idleTimer);
            }
        };
    }, [isDesktop, data, initialized, current, handleSetEpisode]);

    async function loadData() {
        if (skipRemoteApi) {
            setData(offlinePlayerData);
            setLoading(false);
            return;
        }
        const result = await api<IPlayerData>('movie/info', {
            data: {
                id: params['id'],
            },
            loading: false,
        });
        if (result.c !== 0) {
            setLoading(false);
            return;
        }
        setData(result.d);
        setLoading(false);
    }

    useEffect(() => {
        clearEpisodeDetailCache();
        clearEpisodePeekFrameCache();
        didInitialLayoutRef.current = false;
        setInitialized(false);
    }, [params['id']]);

    useEffect(() => {
        if (!data) {
            return;
        }
        /** 勿用 `current`：首屏 `data` 先到时常仍为 0，会与 URL 集数不一致，导致多预拉一整段再预拉正确段 */
        const center = resolveVideoListIndexFromUrlSegment(data.episodes, params['episode']);
        const ids = getEpisodeIdsToPrewarm(data.episodes, center, viewerIsVip, !isDesktop);
        for (const episodeId of ids) {
            void prewarmEpisodeDetail(episodeId, { viewerIsVip });
        }
    }, [data, params['episode'], viewerIsVip, isDesktop]);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        void loadData();
    }, [sessionBootstrapReady, params['id']]);

    /** `/video/:id` 无第三段时规范到首集，便于分享与 params 一致 */
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
    }, [data, loading, params['id'], params['episode'], navigate, location.search, location.state]);

    useEffect(() => {
        rootStore.setTheme('dark');
        return () => {
            rootStore.setTheme('light');
        };
    }, []);

    /** 进入/退出容器全屏后：高度链变化须重算 translate；须与 URL 集对齐 localIndex，并在 flushSync 后再 slideInit，避免仍用旧 slide 高度累加 */
    useEffect(() => {
        if (!data || loading) {
            return;
        }
        const bump = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const outer = outerRef.current;
                    const list = listRef.current;
                    if (!outer || !list) {
                        return;
                    }
                    const outerH = outer.clientHeight;
                    if (outerH <= 0) {
                        return;
                    }
                    const listIndex = resolveVideoListIndexFromUrlSegment(data.episodes, params['episode']);
                    slideStateRef.current.localIndex = listIndex;
                    slideStateRef.current.wrapper.height = outerH;
                    flushSync(() => {
                        setViewportH(outerH);
                        setCurrent(listIndex);
                    });
                    slideInit(list, slideStateRef.current, outerH, data.episodes.length);
                });
            });
        };
        document.addEventListener('fullscreenchange', bump);
        document.addEventListener('webkitfullscreenchange', bump as EventListener);
        return () => {
            document.removeEventListener('fullscreenchange', bump);
            document.removeEventListener('webkitfullscreenchange', bump as EventListener);
        };
    }, [data, loading, params['episode']]);

    const slideH = viewportH > 0 ? viewportH : undefined;

    return loading ? (
        <div className="w-full h-full flex justify-center items-center">
            <Loader color="light" />
        </div>
    ) : (
        <div ref={fullscreenTargetRef} className="video-fullscreen-target h-full w-full">
            <div
                ref={outerRef}
                className="video-vertical-swiper relative h-full w-full touch-none overflow-hidden bg-black select-none"
            >
                <div
                    ref={listRef}
                    className="flex w-full flex-col"
                    style={{ touchAction: 'none' }}
                >
                    {data
                        ? data.episodes.map((v, k) => {
                        const isActive = initialized && current === k;
                        const isNeighbor =
                            initialized && !isDesktop && (k === current - 1 || k === current + 1);
                        const isDesktopNeighborSlide =
                            initialized && isDesktop && (k === current - 1 || k === current + 1);
                        const lockedForViewer = isVipLockedEpisodeRow(v) && !viewerIsVip;
                        const slideBgStyle: { backgroundImage?: string } =
                            isDesktopNeighborSlide && dramaPosterUrl && !lockedForViewer
                                ? {
                                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.58) 100%), url(${JSON.stringify(dramaPosterUrl)})`,
                                  }
                                : {};
                        return (
                            <div
                                key={v.id}
                                className="relative w-full shrink-0 bg-center bg-cover"
                                style={{
                                    ...(slideH !== undefined ? { height: slideH } : { height: '100%' }),
                                    ...slideBgStyle,
                                }}
                            >
                                {isNeighbor && shouldMountNeighborPeekPlayer(v, viewerIsVip) && (
                                    <div className="pointer-events-none absolute inset-0 z-[1] h-full w-full">
                                        <VideoPlayer
                                            key={`${v.id}-peek`}
                                            id={v.id}
                                            index={k}
                                            data={data}
                                            onSetEpisode={handleSetEpisode}
                                            fullscreenTargetRef={fullscreenTargetRef}
                                            shouldKeepFullscreen={keepFullscreen}
                                            onFullscreenPrefChange={setKeepFullscreen}
                                            onEpisodeFullscreenReady={handleEpisodeFullscreenReady}
                                            shouldIgnoreFullscreenExit={shouldIgnoreFullscreenExit}
                                            fromHomeVideoPlayback={false}
                                            legacyEpisodeAutoplayRef={neighborLegacyAutoplayRef}
                                            playbackPolicy="paused"
                                        />
                                    </div>
                                )}
                                {isActive && (
                                    <div className="relative z-[2] h-full w-full">
                                        <VideoPlayer
                                            key={`${v.id}-main`}
                                            id={v.id}
                                            index={k}
                                            data={data}
                                            onSetEpisode={handleSetEpisode}
                                            fullscreenTargetRef={fullscreenTargetRef}
                                            shouldKeepFullscreen={keepFullscreen}
                                            onFullscreenPrefChange={setKeepFullscreen}
                                            onEpisodeFullscreenReady={handleEpisodeFullscreenReady}
                                            shouldIgnoreFullscreenExit={shouldIgnoreFullscreenExit}
                                            fromHomeVideoPlayback={fromHomeVideoPlayback}
                                            legacyEpisodeAutoplayRef={legacyEpisodeAutoplayRef}
                                        />
                                    </div>
                                )}
                                {isDesktop && (current - 1 === k || current + 1 === k) && (
                                    <div className="video-vertical-slide-label flex h-full w-full items-center justify-center text-2xl text-white">
                                        <div>
                                            <FormattedMessage id="episode" /> {v.episode} /{' '}
                                            {data.episodes.length}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                        })
                        : null}
                </div>
                {data && showEpisodeFrameQueue && (
                    <EpisodeFrameQueueOverlay episodes={data.episodes} activeListIndex={current} />
                )}
            </div>
        </div>
    );
}
