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
    /** douyin：首条 isPlay=true；换条靠 bus ITEM_PLAY/STOP */
    isPlay: boolean;
};

function detachVideoMedia(video: HTMLVideoElement): void {
    video.pause();
    video.removeAttribute('src');
    while (video.firstChild) {
        video.removeChild(video.firstChild);
    }
    video.load();
}

function attachVideoMedia(video: HTMLVideoElement, url: string): void {
    if (!url) {
        return;
    }
    const hit = video.querySelector('source');
    if (hit?.getAttribute('src') === url) {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            video.load();
        }
        return;
    }
    detachVideoMedia(video);
    const source = document.createElement('source');
    source.src = url;
    source.type = 'video/mp4';
    video.appendChild(source);
    video.preload = 'auto';
    video.load();
}

/** douyin `BaseVideo.vue`：仅当前条挂 src，邻格只显示 poster，减轻手机内存与并发请求 */
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
    /** 邻格挂载时 isPlay=false，但 ITEM_PLAY 后需播；勿用 props.isPlay 判断 canplay */
    const wantPlayRef = useRef(isPlay);

    const isPlaying = status === SlideItemPlayStatus.Play;
    const poster = item.video.poster ?? item.video.cover.url_list[0] ?? '';
    const primaryUrl = item.video.play_addr.url_list[0] ?? '';

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

        const retryPlayIfWanted = () => {
            if (!wantPlayRef.current || !video.querySelector('source')) {
                return;
            }
            setStatus(SlideItemPlayStatus.Play);
            video.volume = 1;
            syncMuted();
            safePlay(video);
        };

        const doPlay = (resetTime: boolean) => {
            wantPlayRef.current = true;
            attachVideoMedia(video, primaryUrl);
            if (resetTime) {
                video.currentTime = 0;
            }
            setStatus(SlideItemPlayStatus.Play);
            video.volume = 1;
            syncMuted();
            safePlay(video);
        };

        const doPause = () => {
            wantPlayRef.current = false;
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
                detachVideoMedia(video);
                doPause();
                window.setTimeout(() => {
                    ignoreWaiting = false;
                }, 300);
            } else if (type === DEMO_EVENT_KEY.ITEM_PLAY) {
                ignoreWaiting = true;
                /** 切条：勿 resetTime+重复 detach，避免 Network 里 (canceled) 后黑屏 */
                doPlay(false);
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

        demoBus.on(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, onBroadcast);
        demoBus.on(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
        demoBus.on(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE, onHideMutedNotice);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', retryPlayIfWanted);
        video.addEventListener('loadeddata', retryPlayIfWanted);

        syncMuted();
        video.preload = 'none';
        wantPlayRef.current = isPlay;
        if (isPlay) {
            doPlay(false);
        } else {
            doPause();
        }

        return () => {
            wantPlayRef.current = false;
            demoBus.off(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, onBroadcast);
            demoBus.off(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
            demoBus.off(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE, onHideMutedNotice);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', retryPlayIfWanted);
            video.removeEventListener('loadeddata', retryPlayIfWanted);
            detachVideoMedia(video);
        };
    }, [item.aweme_id, isPlay, position.index, position.uniqueId, primaryUrl]);

    const progressClass = isMove ? 'move' : isPlaying ? '' : 'stop';
    const showProgress = duration > 15 || isMove || !isPlaying;

    return (
        <div className={`demo-douyin-video-wrapper item-${position.uniqueId}-${position.index}`}>
            {loading ? <div className="demo-douyin-video-loading" aria-hidden /> : null}
            <video
                ref={videoRef}
                poster={poster}
                muted={isMuted}
                preload="none"
                loop
                playsInline
                {...({ 'webkit-playsinline': 'true', 'x5-playsinline': 'true' } as Record<string, string>)}
                x-webkit-airplay="allow"
            />
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
