/**
 * QD: 9085 模块 55299（L114–341 function x）
 * 见 QUICKDRAMA-REFERENCE.md §功能3、§功能4
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import Player from 'xgplayer';

import {
    bindQdPlayerControlTouches,
    bindQdTextTrackChange,
    createQdXgPlayer,
    QD_PLAYER_EVENTS,
    switchQdDefaultSubtitle,
} from './qdCreatePlayer';
import type { QdFeedDemoItem } from './types';

export type QdVideoSlotProps = {
    videoId: string;
    index: number;
    src: string;
    pic: string;
    height?: number;
    controls?: boolean;
    loop?: boolean;
    isPc?: boolean;
    isRecommandPage?: boolean;
    isPlay: boolean;
    isLocked?: boolean;
    subtitleUrlList?: QdFeedDemoItem['subtitleUrlList'];
    onVideoStart?: () => void;
    onVideoEnd?: () => void;
    defaultLanguage?: string;
    onDefaultLanguageChange?: (code: string) => void;
};

export function QdVideoSlot({
    videoId,
    index: _index,
    src,
    pic,
    height = window.innerHeight,
    controls = true,
    loop = false,
    isPc = false,
    isRecommandPage = false,
    isPlay,
    isLocked = false,
    subtitleUrlList = [],
    onVideoStart,
    onVideoEnd,
    defaultLanguage,
    onDefaultLanguageChange,
}: QdVideoSlotProps) {
    const location = useLocation();
    const [mountedVideoId, setMountedVideoId] = useState<string>();
    const playerRef = useRef<Player | null>(null);
    const readyRef = useRef(false);
    const mountRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [locallyPlaying, setLocallyPlaying] = useState(false);

    const setPlayerReady = (value: boolean) => {
        readyRef.current = value;
        setReady(value);
    };

    const initPlayer = () => {
        const mountEl = mountRef.current ?? document.getElementById(`video-${videoId}`);
        if (!mountEl) return;

        const player = createQdXgPlayer({
            el: mountEl,
            videoId,
            url: src,
            poster: pic,
            height,
            controls,
            loop,
            isRecommandPage,
            subtitleUrlList,
            defaultLanguage,
        });

        if (onDefaultLanguageChange) {
            bindQdTextTrackChange(player, onDefaultLanguageChange);
        }

        player.on(QD_PLAYER_EVENTS.READY, () => {
            setPlayerReady(true);
            onVideoStart?.();
            bindQdPlayerControlTouches(videoId);
        });

        player.on(QD_PLAYER_EVENTS.ENDED, () => {
            onVideoEnd?.();
        });

        const demoPath = location.pathname.includes('/qd-feed-demo');
        player.on(QD_PLAYER_EVENTS.PLAY, () => {
            if (demoPath) document.body.classList.add('url-video-play');
        });
        player.on(QD_PLAYER_EVENTS.PLAYING, () => {
            if (demoPath) document.body.classList.add('url-video-play');
        });
        player.on(QD_PLAYER_EVENTS.PAUSE, () => {
            if (demoPath) document.body.classList.remove('url-video-play');
        });

        playerRef.current = player;
    };

    /** QD: L236–240 videoId 变 → destroy → K() */
    useLayoutEffect(() => {
        if (isLocked) return;

        if (mountedVideoId !== videoId && playerRef.current) {
            playerRef.current.destroy();
            playerRef.current = null;
            setPlayerReady(false);
            initPlayer();
        } else if (!playerRef.current) {
            initPlayer();
        }
        setMountedVideoId(videoId);

        return () => {
            // QD L236–240 cleanup：仅 ready(O) 时 pause + destroy
            if (!readyRef.current) return;
            playerRef.current?.pause();
            playerRef.current?.destroy();
            playerRef.current = null;
            setPlayerReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- QD 仅依赖 [k, L]
    }, [videoId, isLocked]);

    /** QD: L227–235 就绪后按 defaultLanguage 切字幕 */
    useEffect(() => {
        if (!ready || !playerRef.current) return;
        switchQdDefaultSubtitle(playerRef.current, subtitleUrlList, defaultLanguage);
    }, [ready, defaultLanguage, subtitleUrlList]);

    /** QD: L258–267 popstate → pause */
    useEffect(() => {
        const onPopState = () => {
            if (ready) {
                playerRef.current?.pause();
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [location.pathname, ready]);

    /** QD: L268–279 isPlay */
    useEffect(() => {
        if (!ready) return;
        if (isPlay) {
            if (!locallyPlaying) {
                window.setTimeout(() => {
                    void playerRef.current?.play();
                    setLocallyPlaying(true);
                }, 200);
            }
        } else {
            playerRef.current?.pause();
            setLocallyPlaying(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- QD 依赖 [C, O] 不含 F
    }, [isPlay, ready]);

    if (isLocked) {
        return (
            <div
                className="bg-black flex justify-center items-center relative"
                style={{ width: '100%', height: window.innerHeight, zIndex: 2 }}
            >
                <img src={pic} alt="video" className="w-full h-full object-contain z-[10]" />
            </div>
        );
    }

    return (
        <div
            style={{ height }}
            className={`flex justify-center items-center relative ${isRecommandPage ? 'isRecommandPage' : ''}`}
        >
            <div
                ref={mountRef}
                id={`video-${videoId}`}
                className={isPc ? 'isPc-true-video' : 'isPc-false-video'}
                onClick={() => {
                    if (!ready) return;
                    if (locallyPlaying) {
                        setLocallyPlaying(false);
                        playerRef.current?.pause();
                    } else {
                        setLocallyPlaying(true);
                        void playerRef.current?.play();
                    }
                }}
            />
        </div>
    );
}
