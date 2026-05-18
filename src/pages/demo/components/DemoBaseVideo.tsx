import { useLayoutEffect, useRef, useState } from 'react';
import type { DemoAwemeItem } from '../data/buildDemoAwemeFeed';
import { demoBus, DEMO_EVENT_KEY, type DemoBroadcastPayload } from '../douyin/bus';
import { SlideItemPlayStatus } from '../douyin/constVar';
import { safePlay } from '../douyin/safePlay';
import { formatDuration, stopPropagation } from '../douyin/utils';
import { DemoMuteButton } from './DemoMuteButton';

type Props = {
    item: DemoAwemeItem;
    position: { uniqueId: string; index: number };
    /** douyin：首条 isPlay=true + autoplay；换条靠 bus ITEM_PLAY/STOP */
    isPlay: boolean;
};

/** douyin `BaseVideo.vue` 精简：单 useLayoutEffect 管播放/静音/bus */
export function DemoBaseVideo({ item, position, isPlay }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState(() =>
        isPlay ? SlideItemPlayStatus.Play : SlideItemPlayStatus.Pause,
    );
    const [isMuted, setIsMuted] = useState(() => Boolean(window.isMuted));
    const [showMutedNotice, setShowMutedNotice] = useState(() => Boolean(window.showMutedNotice));
    const [loading, setLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(-1);
    const [playX, setPlayX] = useState(0);
    const [isMove, setIsMove] = useState(false);
    const stepRef = useRef(0);
    const dragRef = useRef({ startX: 0, lastX: 0, lastTime: 0 });

    const isPlaying = status === SlideItemPlayStatus.Play;
    const poster = item.video.poster ?? item.video.cover.url_list[0] ?? '';
    const urls = item.video.play_addr.url_list;

    useLayoutEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }

        const { uniqueId, index } = position;
        let ignoreWaiting = false;

        const syncMuted = () => {
            const m = Boolean(window.isMuted);
            video.muted = m;
            setIsMuted(m);
        };

        const doPlay = (resetTime: boolean) => {
            if (resetTime) {
                video.currentTime = 0;
            }
            setStatus(SlideItemPlayStatus.Play);
            video.volume = 1;
            syncMuted();
            safePlay(video);
        };

        const doPause = () => {
            setStatus(SlideItemPlayStatus.Pause);
            video.pause();
        };

        const onBroadcast = (payload: unknown) => {
            const { uniqueId: uid, index: idx, type } = payload as DemoBroadcastPayload;
            if (uid !== uniqueId || idx !== index) {
                return;
            }
            if (type === DEMO_EVENT_KEY.ITEM_TOGGLE) {
                if (video.paused) {
                    doPlay(false);
                } else {
                    doPause();
                }
            } else if (type === DEMO_EVENT_KEY.ITEM_STOP) {
                ignoreWaiting = true;
                video.currentTime = 0;
                doPause();
                window.setTimeout(() => {
                    ignoreWaiting = false;
                }, 300);
            } else if (type === DEMO_EVENT_KEY.ITEM_PLAY) {
                ignoreWaiting = true;
                doPlay(true);
                window.setTimeout(() => {
                    ignoreWaiting = false;
                }, 300);
            }
        };

        const onRemoveMuted = () => {
            window.isMuted = false;
            setIsMuted(false);
            setShowMutedNotice(false);
            video.muted = false;
            video.volume = 1;
        };

        const onHideMutedNotice = () => setShowMutedNotice(false);

        const onTimeUpdate = () => {
            const t = Math.ceil(video.currentTime);
            setCurrentTime(t);
            setPlayX((t - 1) * stepRef.current);
        };

        const onLoadedMetadata = () => {
            setDuration(video.duration);
            const rect = progressRef.current?.getBoundingClientRect();
            if (rect && video.duration > 0) {
                stepRef.current = rect.width / Math.floor(video.duration);
            }
        };

        const onWaiting = () => {
            if (!video.paused && !ignoreWaiting) {
                setLoading(true);
            }
        };

        const onPlaying = () => setLoading(false);

        const tryStartIfActive = () => {
            if (!isPlay) {
                return;
            }
            doPlay(false);
        };

        demoBus.on(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, onBroadcast);
        demoBus.on(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
        demoBus.on(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE, onHideMutedNotice);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', tryStartIfActive, { once: true });

        syncMuted();
        if (isPlay) {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                tryStartIfActive();
            }
        } else {
            doPause();
        }

        return () => {
            demoBus.off(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, onBroadcast);
            demoBus.off(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
            demoBus.off(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE, onHideMutedNotice);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', tryStartIfActive);
            video.pause();
        };
    }, [item.aweme_id, isPlay, position.index, position.uniqueId]);

    const progressClass = isMove ? 'move' : isPlaying ? '' : 'stop';
    const showProgress = duration > 15 || isMove || !isPlaying;

    return (
        <div className={`demo-douyin-video-wrapper item-${position.uniqueId}-${position.index}`}>
            {loading ? <div className="demo-douyin-video-loading" aria-hidden /> : null}
            <video
                ref={videoRef}
                poster={poster}
                muted={isMuted}
                preload="auto"
                loop
                playsInline
                x-webkit-airplay="allow"
            >
                {urls.map((url) => (
                    <source key={url} src={url} type="video/mp4" />
                ))}
            </video>
            {!isPlaying ? (
                <svg className="demo-douyin-pause-icon" viewBox="0 0 28 28" aria-hidden>
                    <path fill="currentColor" d="M8 5v18l15-9z" />
                </svg>
            ) : null}
            <div className="demo-douyin-float">
                <div className="demo-douyin-normal" style={{ opacity: isMove ? 0 : 1 }}>
                    <div className="demo-douyin-mute-slot">
                        <DemoMuteButton
                            isMuted={isMuted}
                            showNotice={showMutedNotice}
                            isPlaying={isPlaying}
                            onUnmute={() => demoBus.emit(DEMO_EVENT_KEY.REMOVE_MUTED)}
                        />
                    </div>
                </div>
                <div
                    className={`demo-douyin-progress ${progressClass}`}
                    ref={progressRef}
                    onTouchStart={(e) => {
                        stopPropagation(e.nativeEvent);
                        const t = e.touches[0]!;
                        dragRef.current.startX = t.pageX;
                        dragRef.current.lastX = playX;
                        dragRef.current.lastTime = currentTime;
                    }}
                    onTouchMove={(e) => {
                        stopPropagation(e.nativeEvent);
                        setIsMove(true);
                        setStatus(SlideItemPlayStatus.Pause);
                        videoRef.current?.pause();
                        const dx = e.touches[0]!.pageX - dragRef.current.startX;
                        const nx = dragRef.current.lastX + dx;
                        setPlayX(nx);
                        let nt = dragRef.current.lastTime + Math.ceil(dx / (stepRef.current || 1));
                        nt = Math.max(0, Math.min(nt, duration));
                        setCurrentTime(nt);
                    }}
                    onTouchEnd={(e) => {
                        stopPropagation(e.nativeEvent);
                        if (isPlaying) {
                            return;
                        }
                        window.setTimeout(() => setIsMove(false), 1000);
                        const video = videoRef.current;
                        if (video) {
                            video.currentTime = currentTime;
                            setStatus(SlideItemPlayStatus.Play);
                            safePlay(video);
                        }
                    }}
                >
                    {isMove ? (
                        <div className="time">
                            <span className="currentTime">{formatDuration(currentTime)}</span>
                            <span className="duration"> / {formatDuration(duration)}</span>
                        </div>
                    ) : null}
                    {showProgress ? (
                        <>
                            <div className="bg" />
                            <div className="progress-line" style={{ width: `${playX}px` }} />
                            <div className="point" />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
