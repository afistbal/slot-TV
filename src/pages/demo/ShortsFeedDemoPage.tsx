import { useCallback, useEffect, useRef, useState } from 'react';
import { Mousewheel } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { SHORTS_DEMO_VIDEOS } from './shortsDemoVideos';

/**
 * `/zgjdemo`：对齐 Vue 首页推荐流「只要全屏竖滑 + 播放器」——无顶栏/侧栏/底栏、无 xgplayer、无截帧遮罩。
 * 当前条静音自动播，其它条暂停并归零。
 */
export default function ShortsFeedDemoPage() {
    const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
    const [activeIndex, setActiveIndex] = useState(0);

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

    useEffect(() => {
        syncPlayback(activeIndex);
    }, [activeIndex, syncPlayback]);

    return (
        <div
            className="fixed inset-0 z-[1] bg-black"
            style={{ height: '100dvh', width: '100vw' }}
        >
            <Swiper
                className="h-full w-full"
                direction="vertical"
                slidesPerView={1}
                speed={320}
                resistanceRatio={0.55}
                modules={[Mousewheel]}
                mousewheel={{ forceToAxis: true, sensitivity: 1, thresholdDelta: 16 }}
                onSlideChangeTransitionEnd={(s) => {
                    setActiveIndex(s.activeIndex);
                }}
            >
                {SHORTS_DEMO_VIDEOS.map((item, i) => (
                    <SwiperSlide
                        key={item.id}
                        className="relative h-full w-full overflow-hidden bg-black select-none"
                    >
                        <video
                            ref={setVideoRef(i)}
                            className="absolute inset-0 h-full w-full object-cover"
                            src={item.url}
                            muted
                            loop
                            playsInline
                            preload="auto"
                            controls={false}
                        />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
