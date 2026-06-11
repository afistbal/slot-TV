import type { RefObject } from 'react';
import type { IPlayerEpisode } from '@/types/videoPlayer';

/** iOS 起播 kick 与 legacy ForYouPlayer 共用运行时形状（仅类型，实现仍在 legacy 链） */
export type LoadEpisodeRuntime = {
    videoRef: RefObject<HTMLVideoElement | null>;
    subtitlesRef: RefObject<VTTCue[]>;
    autoplayKickTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
    getStaticBase: () => string;
    fromHomeVideoPlayback: boolean;
    legacyEpisodeAutoplayRef: RefObject<boolean>;
    /** 邻格预载等场景：只挂源不 play，避免多路解码抢带宽 */
    suppressPlayback?: boolean;
    setLoading: (v: boolean) => void;
    setEpisode: (d: IPlayerEpisode) => void;
    setPlaybackSources: (urls: string[]) => void;
    setShowTapToUnmute: (v: boolean) => void;
    setWaiting: (v: boolean) => void;
    setPlaying: (v: boolean) => void;
    setCanPlay: (v: boolean) => void;
    showController: (autoClose?: boolean) => void;
    hideController: () => void;
    controllerTimerRef: RefObject<number>;
    isForYouFeed?: boolean;
    onVideoMutedUiSync?: (muted: boolean) => void;
    /** For You 续播：秒，挂源后 seek */
    resumeTimeSec?: number;
    /** 返回 true 时不再改 video / 起播（快速切条或卸载） */
    shouldAbort?: () => boolean;
    /** For You 整页 F5 后首条冷启动（仅首条 true；滑切后为 false，勿用 navigation.reload 判滑切） */
    isFeedColdAutoplay?: boolean;
    /** 邻格 paused + preload=auto 时，挂源后主动多拉几秒媒体 */
    primeNeighborBuffer?: boolean;
};
