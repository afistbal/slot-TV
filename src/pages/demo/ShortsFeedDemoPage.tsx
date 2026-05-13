import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Mousewheel } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import Player from 'xgplayer';
import 'xgplayer/dist/index.min.css';
import 'swiper/css';

import { SHORTS_DEMO_VIDEOS } from './shortsDemoVideos';
import { captureVideoFirstFrameObjectUrl } from './shortsFramePreview';

type XgPlayerInstance = InstanceType<typeof Player>;

const PLAYER_IGNORES = [
    'replay',
    'progress',
    'time',
    'start',
    'volume',
    'fullscreen',
    'cssfullscreen',
    'playbackrate',
    'definition',
    'download',
    'pip',
    'miniscreen',
    'keyboard',
] as const;

const PLAYER_HOST_CLASS =
    'pointer-events-none absolute inset-0 h-full w-full [&_.xgplayer]:pointer-events-none [&_.xgplayer]:h-full [&_.xgplayer]:w-full [&_video]:pointer-events-none';

const DEMO_SEARCH_TAGS = ['Revenge', 'Counterattack', 'Urban'] as const;

/**
 * 1）进入页后按 `SHORTS_DEMO_VIDEOS` 顺序依次离屏截首帧 → 每条对应一张 Blob 图。
 * 2）滑动切换时底层先展示该条的截帧图，单例 xgplayer 再 `switchURL` 盖在上面播放。
 */
export default function ShortsFeedDemoPage() {
    const navigate = useNavigate();
    const swiperRef = useRef<SwiperClass | null>(null);
    const slideHostsRef = useRef<Array<HTMLDivElement | null>>([]);
    const playerRef = useRef<XgPlayerInstance | null>(null);
    const playerHostElRef = useRef<HTMLDivElement | null>(null);
    const playerCreatedRef = useRef(false);
    const prevActiveIndexRef = useRef(0);
    const activeIndexRef = useRef(0);
    const captureSeqRef = useRef(0);
    const previewByIdRef = useRef<Record<number, string>>({});

    const [soundEnabled, setSoundEnabled] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [previewById, setPreviewById] = useState<Record<number, string>>({});
    const [captureProgress, setCaptureProgress] = useState<null | { done: number; total: number }>(null);

    activeIndexRef.current = activeIndex;

    const handleEnded = useCallback(() => {
        const i = activeIndexRef.current;
        if (i < SHORTS_DEMO_VIDEOS.length - 1) {
            swiperRef.current?.slideNext();
        }
    }, []);

    const ensurePlayer = useCallback(
        (firstHost: HTMLDivElement) => {
            if (playerCreatedRef.current) {
                return;
            }
            playerCreatedRef.current = true;

            const host = document.createElement('div');
            host.className = PLAYER_HOST_CLASS;
            firstHost.appendChild(host);
            playerHostElRef.current = host;

            const firstUrl = SHORTS_DEMO_VIDEOS[0].url;
            const player = new Player({
                el: host,
                url: firstUrl,
                width: '100%',
                height: '100%',
                autoplay: true,
                autoplayMuted: true,
                muted: true,
                playsinline: true,
                controls: false,
                videoFillMode: 'cover',
                loop: false,
                videoAttributes: {
                    preload: 'auto',
                    playsInline: true,
                },
                ignores: [...PLAYER_IGNORES],
            });

            playerRef.current = player;
            player.on('ended', handleEnded);
        },
        [handleEnded],
    );

    const setSlideHostRef = useCallback(
        (index: number) => (el: HTMLDivElement | null) => {
            slideHostsRef.current[index] = el;
            if (index === 0 && el) {
                ensurePlayer(el);
            }
        },
        [ensurePlayer],
    );

    /** 按序列依次截首帧（串行，减轻同时解码压力）；卸载或 Strict 重挂载时作废后续结果。 */
    useEffect(() => {
        const runId = ++captureSeqRef.current;
        const total = SHORTS_DEMO_VIDEOS.length;
        setCaptureProgress({ done: 0, total });

        void (async () => {
            for (let i = 0; i < SHORTS_DEMO_VIDEOS.length; i++) {
                if (runId !== captureSeqRef.current) {
                    return;
                }
                const item = SHORTS_DEMO_VIDEOS[i];
                const blobUrl = await captureVideoFirstFrameObjectUrl(item.url, {
                    maxWaitMs: 8000,
                    targetMaxEdge: 540,
                });
                if (runId !== captureSeqRef.current) {
                    if (blobUrl) {
                        URL.revokeObjectURL(blobUrl);
                    }
                    return;
                }
                if (blobUrl) {
                    setPreviewById((prev) => {
                        if (prev[item.id]) {
                            URL.revokeObjectURL(blobUrl);
                            return prev;
                        }
                        const merged = { ...prev, [item.id]: blobUrl };
                        previewByIdRef.current = merged;
                        return merged;
                    });
                }
                setCaptureProgress({ done: i + 1, total });
            }
            if (runId === captureSeqRef.current) {
                setCaptureProgress(null);
            }
        })();

        return () => {
            captureSeqRef.current += 1;
        };
    }, []);

    useEffect(() => {
        return () => {
            for (const u of Object.values(previewByIdRef.current)) {
                if (u) {
                    URL.revokeObjectURL(u);
                }
            }
            previewByIdRef.current = {};

            const p = playerRef.current;
            if (p) {
                p.off('ended', handleEnded);
                p.destroy();
            }
            playerRef.current = null;
            const host = playerHostElRef.current;
            if (host?.isConnected) {
                host.remove();
            }
            playerHostElRef.current = null;
            playerCreatedRef.current = false;
        };
    }, [handleEnded]);

    useEffect(() => {
        const p = playerRef.current;
        const host = playerHostElRef.current;
        if (!p || !host) {
            return;
        }

        const parent = slideHostsRef.current[activeIndex];
        if (!parent) {
            return;
        }

        if (host.parentElement !== parent) {
            parent.appendChild(host);
        }

        const indexChanged = prevActiveIndexRef.current !== activeIndex;
        prevActiveIndexRef.current = activeIndex;

        if (indexChanged) {
            const url = SHORTS_DEMO_VIDEOS[activeIndex]?.url;
            if (url) {
                void p.switchURL(url, { seamless: true });
            }
        }

        p.muted = !soundEnabled;
        void p.play();
    }, [activeIndex, soundEnabled]);

    const handleUnlockSound = () => {
        setSoundEnabled(true);
    };

    const goSearchWithTag = (tag: string) => {
        navigate(`/search?${new URLSearchParams({ movie_tag: tag }).toString()}`);
    };

    return (
        <div className="shorts-demo-root relative h-[100dvh] w-full overflow-hidden bg-black text-white">
            <Swiper
                className="h-full w-full"
                direction="vertical"
                slidesPerView={1}
                speed={380}
                resistanceRatio={0.65}
                modules={[Mousewheel]}
                mousewheel={{ forceToAxis: true, sensitivity: 1, thresholdDelta: 20 }}
                onSwiper={(s) => {
                    swiperRef.current = s;
                }}
                onSlideChangeTransitionEnd={(s) => {
                    const i = s.activeIndex;
                    setActiveIndex(i);
                    activeIndexRef.current = i;
                }}
            >
                {SHORTS_DEMO_VIDEOS.map((v, i) => (
                    <SwiperSlide
                        key={v.id}
                        className="relative h-full w-full select-none overflow-hidden bg-black"
                    >
                        {previewById[v.id] ? (
                            <img
                                src={previewById[v.id]}
                                alt=""
                                className="absolute inset-0 z-0 h-full w-full object-cover pointer-events-none"
                                draggable={false}
                            />
                        ) : null}
                        <div
                            ref={setSlideHostRef(i)}
                            className="absolute inset-0 z-[1]"
                            aria-hidden
                        />
                        {v.title ? (
                            <p className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] max-h-[30%] overflow-hidden px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 text-center text-sm font-medium leading-snug text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.85)]">
                                {v.title}
                            </p>
                        ) : null}
                    </SwiperSlide>
                ))}
            </Swiper>

            {!soundEnabled ? (
                <button
                    type="button"
                    className="absolute inset-0 z-[2] flex cursor-pointer items-center justify-center bg-black/35 text-sm text-white backdrop-blur-[2px]"
                    onClick={handleUnlockSound}
                >
                    轻触开启声音
                </button>
            ) : null}

            <div className="absolute inset-x-0 top-0 z-[3] flex flex-col gap-1.5 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="pointer-events-none flex flex-wrap items-start justify-between gap-x-2 gap-y-1 text-xs text-white/70">
                    <span>/zgjdemo · 单例 + 序列截帧</span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                        <span>
                            {activeIndex + 1} / {SHORTS_DEMO_VIDEOS.length}
                        </span>
                        {captureProgress ? (
                            <span className="text-white/55">
                                截帧 {captureProgress.done}/{captureProgress.total}
                            </span>
                        ) : null}
                    </span>
                </div>
                <div className="flex flex-wrap gap-1 text-sm">
                    {DEMO_SEARCH_TAGS.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            className="rounded-sm bg-slate-600 px-2 py-1 text-slate-300 active:opacity-80"
                            onClick={() => goSearchWithTag(tag)}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
