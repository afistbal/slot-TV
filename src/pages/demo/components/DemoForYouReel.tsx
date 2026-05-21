import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import type { DemoAwemeItem } from '../data/buildDemoAwemeFeed';
import { demoBus, DEMO_EVENT_KEY } from '../douyin/bus';
import { DemoMuteButton } from './DemoMuteButton';

type Props = {
    list: DemoAwemeItem[];
};

/**
 * /for-you 专用：Swiper 竖滑 + 仅当前条挂 mp4（8 条 demo，不做虚拟 DOM 增量）。
 * 避免 SlideVerticalInfinite 在手机上 insertContent / pointer 竞态导致卡死。
 */
export function DemoForYouReel({ list }: Props) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(() => Boolean(window.isMuted));
    const [showMutedNotice, setShowMutedNotice] = useState(() => Boolean(window.showMutedNotice));
    const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

    const setVideoRef = useCallback(
        (i: number) => (el: HTMLVideoElement | null) => {
            videoRefs.current[i] = el;
        },
        [],
    );

    const syncPlayback = useCallback(
        (index: number) => {
            list.forEach((item, i) => {
                const video = videoRefs.current[i];
                if (!video) {
                    return;
                }
                const url = item.video.play_addr.url_list[0] ?? '';
                if (i === index) {
                    if (url && video.getAttribute('src') !== url) {
                        video.src = url;
                        video.load();
                    }
                    video.muted = Boolean(window.isMuted);
                    setIsMuted(video.muted);
                    void video.play().catch(() => {});
                } else {
                    video.pause();
                    video.removeAttribute('src');
                    video.load();
                }
            });
        },
        [list],
    );

    useEffect(() => {
        syncPlayback(activeIndex);
    }, [activeIndex, syncPlayback]);

    useEffect(() => {
        const onRemoveMuted = () => {
            window.isMuted = false;
            setIsMuted(false);
            setShowMutedNotice(false);
            const v = videoRefs.current[activeIndex];
            if (v) {
                v.muted = false;
                void v.play().catch(() => {});
            }
        };
        const onHideNotice = () => setShowMutedNotice(false);
        demoBus.on(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
        demoBus.on(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE, onHideNotice);
        return () => {
            demoBus.off(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
            demoBus.off(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE, onHideNotice);
        };
    }, [activeIndex]);

    const onSlideChange = useCallback(
        (swiper: SwiperClass) => {
            setActiveIndex(swiper.activeIndex);
        },
        [],
    );

    if (!list.length) {
        return <div className="h-full w-full bg-black" />;
    }

    return (
        <div className="demo-foryou-reel relative h-full w-full overflow-hidden bg-black">
            <Swiper
                className="h-full w-full"
                direction="vertical"
                slidesPerView={1}
                speed={280}
                resistanceRatio={0.55}
                touchReleaseOnEdges
                initialSlide={0}
                onSlideChangeTransitionEnd={onSlideChange}
            >
                {list.map((item, i) => {
                    const poster = item.video.poster ?? item.video.cover.url_list[0] ?? '';
                    const isActive = i === activeIndex;
                    return (
                        <SwiperSlide key={item.aweme_id} className="relative h-full w-full bg-black">
                            <div className="demo-douyin-video-wrapper relative h-full w-full">
                                <video
                                    ref={setVideoRef(i)}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    poster={poster}
                                    muted={isMuted}
                                    playsInline
                                    preload="none"
                                    loop
                                    {...({
                                        'webkit-playsinline': 'true',
                                        'x5-playsinline': 'true',
                                    } as Record<string, string>)}
                                />
                                {!isActive ? (
                                    <div
                                        className="pointer-events-none absolute inset-0 bg-cover bg-center"
                                        style={{ backgroundImage: poster ? `url(${poster})` : undefined }}
                                        aria-hidden
                                    />
                                ) : null}
                                {isActive ? (
                                    <div className="demo-douyin-float pointer-events-none absolute inset-0">
                                        <div className="demo-douyin-normal">
                                            <div className="demo-douyin-mute-slot pointer-events-auto">
                                                <DemoMuteButton
                                                    isMuted={isMuted}
                                                    showNotice={showMutedNotice}
                                                    isPlaying
                                                    onUnmute={() =>
                                                        demoBus.emit(DEMO_EVENT_KEY.REMOVE_MUTED)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
}
