import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Mousewheel } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper'; // SwiperClass used in handler type
import 'swiper/css';
import { useLocation, useNavigate, useParams } from 'react-router';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlinePlayerEpisode } from '@/mocks/videoOffline';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { useConfigStore } from '@/stores/config';

/** 走「Vue 同款」竖滑全屏原生 video 的剧集 id（可继续往 Set 里加） */
export const DOUYIN_STYLE_REEL_MOVIE_IDS = new Set<string>(['3892']);

export function isDouyinStyleReelMovieId(id: string | undefined) {
    return id != null && DOUYIN_STYLE_REEL_MOVIE_IDS.has(String(id));
}

function resolveEpisodeVideoSrc(d: IPlayerEpisode): string | null {
    const videoStr = String(d.video ?? '').trim();
    if (!videoStr) {
        return null;
    }
    if (videoStr.startsWith('http://') || videoStr.startsWith('https://')) {
        return videoStr;
    }
    const staticBase = useConfigStore.getState().config['static'] as string | undefined;
    if (!staticBase) {
        return null;
    }
    const base = staticBase.replace(/\/+$/, '');
    const path = videoStr.replace(/^\/+/, '');
    return `${base}/${path}`;
}

async function fetchEpisodePlayable(episodeRowId: number): Promise<IPlayerEpisode | null> {
    if (skipRemoteApi) {
        return offlinePlayerEpisode(episodeRowId);
    }
    const result = await api<IPlayerEpisode>('movie/episode', {
        data: {
            id: episodeRowId,
            auto_unlock: localStorage.getItem('auto_unlock') ?? 1,
        },
        loading: false,
    });
    if (result.c !== 0) {
        return null;
    }
    return result.d;
}

type Props = {
    data: IPlayerData;
};

/**
 * 与 Vue 首页竖滑一致：全屏 Swiper + 每集一条 `<video>`，仅当前条静音自动播，邻条暂停。
 */
export default function VideoDouyinStyleReel({ data }: Props) {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const movieId = String(params['id'] ?? '');
    const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
    const srcMapRef = useRef<Record<number, string>>({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [srcByEpisodeId, setSrcByEpisodeId] = useState<Record<number, string>>({});

    const initialSlide = useMemo(() => {
        let idx = parseInt(params['index'] ?? '1', 10);
        if (Number.isNaN(idx) || idx < 1) {
            idx = 1;
        }
        return Math.min(Math.max(idx - 1, 0), Math.max(data.episodes.length - 1, 0));
    }, [params['index'], data.episodes.length]);

    useEffect(() => {
        srcMapRef.current = srcByEpisodeId;
    }, [srcByEpisodeId]);

    useEffect(() => {
        setActiveIndex(initialSlide);
    }, [initialSlide]);

    const setVideoRef = useCallback((i: number) => (el: HTMLVideoElement | null) => {
        videoRefs.current[i] = el;
    }, []);

    const syncPlayback = useCallback((index: number) => {
        videoRefs.current.forEach((v, i) => {
            if (!v) return;
            if (i === index) {
                v.muted = true;
                void v.play().catch(() => {});
            } else {
                v.pause();
                try {
                    v.currentTime = 0;
                } catch {
                    /* noop */
                }
            }
        });
    }, []);

    const ensureSrcForIndex = useCallback(
        async (index: number) => {
            const row = data.episodes[index];
            if (!row || srcMapRef.current[row.id]) {
                return;
            }
            const ep = await fetchEpisodePlayable(row.id);
            if (!ep || ep.lock) {
                return;
            }
            const src = resolveEpisodeVideoSrc(ep);
            if (!src) {
                return;
            }
            setSrcByEpisodeId((prev) => (prev[row.id] ? prev : { ...prev, [row.id]: src }));
        },
        [data.episodes],
    );

    useEffect(() => {
        const ids = [activeIndex - 1, activeIndex, activeIndex + 1].filter(
            (i) => i >= 0 && i < data.episodes.length,
        );
        void Promise.all(ids.map((i) => ensureSrcForIndex(i)));
    }, [activeIndex, data.episodes.length, ensureSrcForIndex]);

    useEffect(() => {
        syncPlayback(activeIndex);
    }, [activeIndex, syncPlayback, srcByEpisodeId]);

    const handleBack = useCallback(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    }, [navigate]);

    const handleSlideChangeEnd = useCallback(
        (swiper: SwiperClass) => {
            const i = swiper.activeIndex;
            setActiveIndex(i);
            navigate(`/video/${movieId}/${i + 1}${location.search}`, {
                replace: true,
                state: location.state,
            });
        },
        [navigate, movieId, location.search, location.state],
    );

    return (
        <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-black">
            <button
                type="button"
                onClick={handleBack}
                className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
                aria-label="Back"
            >
                <ChevronLeft className="h-6 w-6" />
            </button>

            <Swiper
                className="h-full w-full"
                direction="vertical"
                slidesPerView={1}
                speed={320}
                resistanceRatio={0.55}
                modules={[Mousewheel]}
                mousewheel={{ forceToAxis: true, sensitivity: 1, thresholdDelta: 16 }}
                initialSlide={initialSlide}
                onSlideChangeTransitionEnd={handleSlideChangeEnd}
            >
                {data.episodes.map((epRow, i) => {
                    const src = srcByEpisodeId[epRow.id];
                    return (
                        <SwiperSlide
                            key={epRow.id}
                            className="relative h-full w-full overflow-hidden bg-black select-none"
                        >
                            {src ? (
                                <video
                                    ref={setVideoRef(i)}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    src={src}
                                    muted
                                    playsInline
                                    preload="auto"
                                    controls={false}
                                    loop
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                                    加载中…
                                </div>
                            )}
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
}
