import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, type SwiperClass, type SwiperRef } from 'swiper/react';
import { useLocation, useNavigate, useParams } from 'react-router';
import Loader from '@/components/Loader';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlinePlayerData } from '@/mocks/videoOffline';
import type { IPlayerData } from '@/types/videoPlayer';
import { useRootStore } from '@/stores/root';
import {
    buildReelEpisodeHref,
    WHEEL_RESET_MS,
    WHEEL_WINDOW_SIZE,
} from './videoReelConstants';
import { isEpisodeVipLocked } from './videoReelUtils';
import { VideoReelPlayer } from './VideoReelPlayer';
import { VideoReelSlideBackdrop } from './VideoReelSlideBackdrop';

export default function VideoReelPage() {
    // const configStore = useConfigStore();
    const rootStore = useRootStore();
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const fromHomeVideoPlayback = Boolean(
        (location.state as { fromHomeVideoPlayback?: boolean } | null)?.fromHomeVideoPlayback,
    );
    const swiperRef = useRef<SwiperRef>(null);
    /**
     * 与历史 video-old 一致：换集后只做 `play()`，失败也不 `muted=true` 再播。
     * 首集首次进入仍为 false，保留当前页的冷启动 / PC 静音策略。
     */
    const legacyEpisodeAutoplayRef = useRef(false);
    /** 仅用于忽略路由同步时的首次 `slideTo`，避免首屏误标成「换集」；用户滑动/点选换集不应走此分支 */
    const suppressLegacySlideChangeOnceRef = useRef(false);
    const [data, setData] = useState<IPlayerData>();
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [keepFullscreen, setKeepFullscreen] = useState(false);
    const fullscreenTargetRef = useRef<HTMLDivElement>(null);
    const suppressFullscreenExitUntilRef = useRef(0);
    const switchingEpisodeInFullscreenRef = useRef(false);

    /** PC 触控板/滚轮：抖音式滑动窗口 + 峰值检测，避免轻微滚动误切集 */
    const wheelSamplesRef = useRef<number[]>([]);
    const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastWheelAtRef = useRef(0);
    const wheelFlipGateRef = useRef(false);
    const wheelInputKindRef = useRef<'unknown' | 'mouse' | 'touch'>('unknown');
    const lastWheelSignRef = useRef(0);

    function markFullscreenTransition() {
        if (!keepFullscreen) {
            return;
        }
        switchingEpisodeInFullscreenRef.current = true;
        suppressFullscreenExitUntilRef.current = Date.now() + 1800;
    }

    const handleEpisodeFullscreenReady = useCallback(() => {
        switchingEpisodeInFullscreenRef.current = false;
    }, []);

    const shouldIgnoreFullscreenExit = useCallback(
        () =>
            switchingEpisodeInFullscreenRef.current ||
            Date.now() <= suppressFullscreenExitUntilRef.current,
        [],
    );

    function handleSetEpisode(index: number) {
        if (swiperRef.current === null) {
            return;
        }
        markFullscreenTransition();
        const max = Math.max(0, (data?.episodes.length ?? 0) - 1);
        const clamped = Math.min(Math.max(index, 0), max);
        const sw = swiperRef.current.swiper;
        /** 已在目标集：仅同步路由/React（不触发 slide 动画，也就没有 transitionEnd） */
        if (sw.activeIndex === clamped) {
            setCurrent(clamped);
            navigate(buildReelEpisodeHref(params['id'], clamped + 1, location.search), {
                replace: true,
                state: location.state,
            });
            return;
        }
        sw.slideTo(clamped, 0);
        /**
         * 必须立刻同步：部分环境下 slideTo(…, 0) 不触发 onSlideChangeTransitionEnd，
         * 若只等 transitionEnd，current 不更新则本格不渲染 Player，会一直全屏转圈。
         * 用户手指滑动换集仍只由 transitionEnd 更新，不经过本函数。
         */
        setCurrent(clamped);
        navigate(buildReelEpisodeHref(params['id'], clamped + 1, location.search), {
            replace: true,
            state: location.state,
        });
    }

    /**
     * 必须在滑动动画结束后再 setCurrent / 换 Player。
     * 若在 onSlideChange（动画中途）就卸载视频，易与 Swiper 触摸跟踪打架，表现为偶发卡死（约几十 %）。
     */
    function handleSlideChangeTransitionEnd(swiper: SwiperClass) {
        markFullscreenTransition();
        const idx = swiper.activeIndex;
        if (suppressLegacySlideChangeOnceRef.current) {
            suppressLegacySlideChangeOnceRef.current = false;
        } else {
            legacyEpisodeAutoplayRef.current = true;
        }
        setCurrent(idx);
        navigate(buildReelEpisodeHref(params['id'], idx + 1, location.search), {
            replace: true,
            state: location.state,
        });
    }

    function handleAfterInit(swiper: SwiperClass) {
        let index = parseInt(params['index'] ?? '-1', 10);
        if (isNaN(index)) {
            return;
        }
        index -= 1;
        if (index < 0 || index >= (data?.episodes.length ?? 0)) {
            index = 0;
        }

        setCurrent(index);
        setInitialized(true);
        suppressLegacySlideChangeOnceRef.current = true;
        swiper.slideTo(index, 0);
        /** slideTo 未产生过渡时可能不触发 transitionEnd，避免 suppress 永远为 true */
        window.setTimeout(() => {
            if (suppressLegacySlideChangeOnceRef.current) {
                suppressLegacySlideChangeOnceRef.current = false;
            }
        }, 150);
    }

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
        loadData();
    }, []);

    useEffect(() => {
        rootStore.setTheme('dark');
        return () => {
            rootStore.setTheme('light');
        };
    }, []);

    useEffect(() => {
        if (loading || !data?.episodes?.length) {
            return;
        }
        const root = fullscreenTargetRef.current;
        if (!root) {
            return;
        }

        const macBoost =
            typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
                ? 120
                : 0;

        const avgTail = (samples: number[], n: number) => {
            if (samples.length === 0) {
                return 0;
            }
            const slice = samples.slice(-Math.max(1, n));
            return Math.ceil(slice.reduce((s, v) => s + v, 0) / slice.length);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (wheelResetTimerRef.current) {
                clearTimeout(wheelResetTimerRef.current);
            }
            wheelResetTimerRef.current = setTimeout(() => {
                wheelSamplesRef.current = [];
                wheelFlipGateRef.current = false;
                wheelInputKindRef.current = 'unknown';
                lastWheelSignRef.current = 0;
            }, WHEEL_RESET_MS);

            const legacy = e as WheelEvent & {
                wheelDelta?: number;
                wheelDeltaX?: number;
                detail?: number;
            };
            const raw =
                typeof legacy.wheelDelta === 'number'
                    ? legacy.wheelDelta
                    : -e.deltaY || -(legacy.detail ?? 0);
            const sign = Math.max(-1, Math.min(1, raw));

            if (sign !== 0 && lastWheelSignRef.current !== 0 && sign !== lastWheelSignRef.current) {
                wheelSamplesRef.current = [];
            }
            if (sign !== 0) {
                lastWheelSignRef.current = sign;
            }

            const hasAxis = e.deltaX !== 0 || e.deltaY !== 0;
            const verticalDominant =
                !hasAxis ||
                Math.abs(e.deltaX) < Math.abs(e.deltaY) ||
                (typeof legacy.wheelDelta === 'number' &&
                    Math.abs(legacy.wheelDeltaX ?? 0) < Math.abs(legacy.wheelDelta));

            let samples = wheelSamplesRef.current;
            const sampleVal = macBoost + Math.abs(raw);
            samples = [...samples, sampleVal];

            if (samples.length > 2) {
                const a = samples[samples.length - 3]!;
                const b = samples[samples.length - 2]!;
                const c = samples[samples.length - 1]!;
                if (b > a && b > c) {
                    samples[samples.length - 2] = Math.max(a, c) + 1;
                } else if (b < a && b < c) {
                    samples[samples.length - 2] = Math.min(a, c) - 1;
                }
            }
            wheelSamplesRef.current = samples;

            const now = Date.now();
            const dt = now - lastWheelAtRef.current;
            lastWheelAtRef.current = now;
            if (dt > WHEEL_RESET_MS && samples.length === 1) {
                const only = samples[0]!;
                wheelSamplesRef.current = [only, only, only];
                wheelFlipGateRef.current = false;
            }

            if (wheelInputKindRef.current === 'unknown') {
                wheelInputKindRef.current = sampleVal > 50 ? 'mouse' : 'touch';
            }

            const win = WHEEL_WINDOW_SIZE;
            const effectiveWin = wheelInputKindRef.current === 'mouse' ? win / 2 : win;
            const R = avgTail(wheelSamplesRef.current, effectiveWin);
            const wide = avgTail(wheelSamplesRef.current, 2 * effectiveWin);
            const spike = R > wide;

            const sw = swiperRef.current?.swiper;
            if (spike && !wheelFlipGateRef.current && verticalDominant && sw && !sw.animating) {
                wheelFlipGateRef.current = true;
                if (sign < 0) {
                    sw.slideNext();
                } else if (sign > 0) {
                    sw.slidePrev();
                } else {
                    wheelFlipGateRef.current = false;
                }
            } else if (!spike && wheelFlipGateRef.current && verticalDominant) {
                wheelFlipGateRef.current = false;
            }
        };

        root.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            root.removeEventListener('wheel', onWheel);
            if (wheelResetTimerRef.current) {
                clearTimeout(wheelResetTimerRef.current);
            }
        };
    }, [loading, data]);

    useEffect(() => {
        if (loading || !data?.episodes?.length) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (
                el &&
                (el.isContentEditable ||
                    el.tagName === 'INPUT' ||
                    el.tagName === 'TEXTAREA' ||
                    el.tagName === 'SELECT')
            ) {
                return;
            }
            const sw = swiperRef.current?.swiper;
            if (!sw || sw.animating) {
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                sw.slideNext();
            } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                sw.slidePrev();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [loading, data]);

    return loading ? (
        <div className="w-full h-full flex justify-center items-center">
            <Loader color="light" />
        </div>
    ) : (
        <div ref={fullscreenTargetRef} className="w-full h-full">
            <Swiper
                ref={swiperRef}
                slidesPerView={1}
                speed={300}
                resistance
                resistanceRatio={0.85}
                threshold={5}
                touchRatio={1}
                longSwipesMs={300}
                onSlideChangeTransitionEnd={handleSlideChangeTransitionEnd}
                onAfterInit={handleAfterInit}
                direction="vertical"
                touchStartPreventDefault={false}
                onTouchStart={() => {
                    legacyEpisodeAutoplayRef.current = true;
                }}
                onPointerDownCapture={() => {
                    legacyEpisodeAutoplayRef.current = true;
                }}
                className="video-vertical-swiper w-full h-full overflow-hidden bg-black select-none touch-pan-y"
            >
                {data?.episodes.map((v, k) => (
                    <SwiperSlide
                        key={v.id}
                        className="relative h-full w-full overflow-hidden bg-black bg-center bg-cover"
                    >
                        {current === k && initialized ? (
                            <VideoReelPlayer
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
                        ) : (
                            <VideoReelSlideBackdrop
                                episodeCurrent={v.episode}
                                episodeTotal={data.episodes.length}
                                vipLocked={isEpisodeVipLocked(v)}
                            />
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
