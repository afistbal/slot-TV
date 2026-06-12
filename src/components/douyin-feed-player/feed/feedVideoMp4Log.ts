import { feedDbg } from './feedDebugLog';
import {
    isProgPauseForVideo,
    isRecentCodedPlay,
    msSinceChainUnmute,
    recentCodedPlaySource,
    recentNeighborMount,
} from './feedPlayAttribution';
import { isUserGestureActive } from './userGesturePlay';

const NETWORK_LABELS = ['empty', 'idle', 'loading', 'no_source'] as const;
const READY_LABELS = ['none', 'metadata', 'current', 'future', 'enough'] as const;

/** 对标 Safari Network：mp4 是否仍在 pending（networkState=loading） */
export function snapshotVideoMp4(video: HTMLVideoElement | null | undefined) {
    if (!video) {
        return { hasVideo: false };
    }

    const src = video.currentSrc || video.getAttribute('src') || video.src || '';
    const ns = video.networkState;
    const rs = video.readyState;

    let bufferedEnd = 0;
    try {
        if (video.buffered.length > 0) {
            bufferedEnd = video.buffered.end(video.buffered.length - 1);
        }
    } catch {
        /* ignore */
    }

    return {
        rs,
        rsLabel: READY_LABELS[rs] ?? String(rs),
        ns,
        nsLabel: NETWORK_LABELS[ns] ?? String(ns),
        /** Safari Network 面板里的 (pending) */
        mp4Pending: ns === HTMLMediaElement.NETWORK_LOADING,
        /** 已有响应、不在拉流 */
        mp4Returned: ns === HTMLMediaElement.NETWORK_IDLE,
        paused: video.paused,
        muted: video.muted,
        ended: video.ended,
        t: Math.round(video.currentTime * 100) / 100,
        dur: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
        bufEnd: Math.round(bufferedEnd * 10) / 10,
        srcTail: src ? src.slice(-64) : '',
        mediaError: video.error?.code ?? null,
    };
}

export function feedVideoMp4(
    event: string,
    video: HTMLVideoElement | null | undefined,
    extra?: Record<string, unknown>,
) {
    feedDbg(event, { ...snapshotVideoMp4(video), ...extra });
}

export function feedVideoMp4FromPlayer(
    event: string,
    player: { video?: HTMLVideoElement | null } | null | undefined,
    extra?: Record<string, unknown>,
) {
    const video = player?.video;
    feedVideoMp4(event, video instanceof HTMLVideoElement ? video : null, extra);
}

/** 挂载 video 媒体事件：pending→idle、error、stalled 等 */
export function attachFeedVideoMp4Diag(
    video: HTMLVideoElement,
    slotIndex: number,
    isActive: () => boolean,
): () => void {
    const log = (name: string) => {
        if (!isActive()) return;
        feedVideoMp4(`video ${name}`, video, { slot: slotIndex });
    };

    const onError = () => log('error');
    const onStalled = () => log('stalled');
    const onWaiting = () => log('waiting');
    const onSuspend = () => log('suspend');
    const onLoadedMetadata = () => log('loadedmetadata');
    const onCanPlay = () => log('canplay');
    const onPlaying = () => {
        if (!isActive()) return;
        if (isRecentCodedPlay()) {
            feedVideoMp4('video playing coded', video, {
                slot: slotIndex,
                source: recentCodedPlaySource(),
            });
            return;
        }
        const sinceUnmute = msSinceChainUnmute();
        if (sinceUnmute != null && sinceUnmute < 800) {
            feedVideoMp4('video playing coded', video, {
                slot: slotIndex,
                source: 'chain-unmute',
                msSinceChainUnmute: sinceUnmute,
            });
            return;
        }
        feedDbg('STALL active playing unattributed', {
            slot: slotIndex,
            gesture: isUserGestureActive(),
            neighbor: recentNeighborMount(),
        });
        feedVideoMp4('video playing', video, { slot: slotIndex, unattributed: true });
    };

    const onPause = () => {
        if (!isActive()) return;
        if (isProgPauseForVideo(video)) {
            feedVideoMp4('video pause coded', video, { slot: slotIndex, reason: 'progPause' });
            return;
        }
        feedDbg('STALL active unexpected pause', {
            slot: slotIndex,
            msSinceChainUnmute: msSinceChainUnmute(),
            neighbor: recentNeighborMount(),
            gesture: isUserGestureActive(),
        });
        feedVideoMp4('video pause', video, { slot: slotIndex, unexpected: true });
    };

    const events: Array<[string, () => void]> = [
        ['error', onError],
        ['stalled', onStalled],
        ['waiting', onWaiting],
        ['suspend', onSuspend],
        ['loadedmetadata', onLoadedMetadata],
        ['canplay', onCanPlay],
        ['playing', onPlaying],
        ['pause', onPause],
    ];

    events.forEach(([ev, fn]) => video.addEventListener(ev, fn));
    feedVideoMp4('video mount', video, { slot: slotIndex });

    return () => {
        events.forEach(([ev, fn]) => video.removeEventListener(ev, fn));
    };
}
