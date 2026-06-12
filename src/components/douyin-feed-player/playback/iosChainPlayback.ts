import type Player from 'xgplayer';

import { feedDbg } from '../feed/feedDebugLog';
import {
    isProgPauseForVideo,
    markChainUnmute,
    markCodedPlay,
    msSinceChainUnmute,
} from '../feed/feedPlayAttribution';
import { readMutedPreference } from '../controls/mutePreference';
import {
    isIosChainWantPlay,
    isUserHoldPause,
    setIosChainWantPlay,
} from '../player/createXgPlayer';
import { detectPlatform } from '../platform/detectPlatform';
import { primeDouyinNeighborBuffer } from './primeNeighborBuffer';

function playErrorName(err: unknown): string {
    return err instanceof Error ? err.name : String(err);
}

function isNeighborRecoverSource(source: string): boolean {
    return /^(post-neighbor|active-pause|unmute-bounce|stalled)/.test(source);
}

function attachChainUnmuteOnPlaying(video: HTMLVideoElement, deferUnmuteMs = 0): void {
    if (readMutedPreference()) return;
    video.addEventListener(
        'playing',
        () => {
            const doUnmute = () => {
                if (readMutedPreference() || video.paused) return;
                video.muted = false;
                markChainUnmute();
                markCodedPlay('chain-unmute');
                feedDbg('chain unmute on playing', {
                    readyState: video.readyState,
                    deferred: deferUnmuteMs,
                });
            };
            if (deferUnmuteMs > 0) {
                window.setTimeout(doUnmute, deferUnmuteMs);
            } else {
                doUnmute();
            }
        },
        { once: true },
    );
}

/** iOS ended 连播：muted bootstrap → playing 后立即 unmute */
export function playIosChainWithSound(video: HTMLVideoElement, source: string): void {
    if (!detectPlatform().isIOS || readMutedPreference()) return;

    const deferUnmuteMs = isNeighborRecoverSource(source) ? 800 : 0;
    attachChainUnmuteOnPlaying(video, deferUnmuteMs);

    if (!video.paused && video.currentTime > 0.05) {
        return;
    }

    feedDbg('ios chain muted bootstrap', {
        source,
        readyState: video.readyState,
        paused: video.paused,
    });

    video.muted = true;
    markCodedPlay(`ios-chain:${source}`);
    void video.play().catch((err: unknown) => {
        const name = playErrorName(err);
        if (name === 'AbortError') return;
        feedDbg('ios chain bootstrap fail', { source, name, readyState: video.readyState });
    });
}

/** ended 媒体栈内：邻格先 muted 起播，避免 NotAllowedError */
export function tryPlayIosChainInEndedStack(
    nextPlayer: Player | undefined,
    nextUrl?: string,
): boolean {
    if (!detectPlatform().isIOS || readMutedPreference()) return false;

    const video = nextPlayer?.video as HTMLVideoElement | undefined;
    if (!video) return false;

    if (nextUrl && nextPlayer) {
        primeDouyinNeighborBuffer(nextPlayer, nextUrl);
    }

    feedDbg('ended stack neighbor', { readyState: video.readyState });
    playIosChainWithSound(video, 'ended-neighbor');
    return true;
}

let lastNeighborRecoverAt = 0;
let neighborRecoverTimer: number | null = null;
let neighborRecoverBurst = 0;
let neighborRecoverBurstAt = 0;

function runNeighborRecover(video: HTMLVideoElement, source: string): boolean {
    if (!video.paused || video.ended) return false;

    setIosChainWantPlay(true);
    feedDbg('ios chain neighbor recover', {
        source,
        readyState: video.readyState,
        t: Math.round(video.currentTime * 100) / 100,
        msSinceChainUnmute: msSinceChainUnmute(),
        burst: neighborRecoverBurst,
    });
    playIosChainWithSound(video, source);
    return true;
}

function scheduleNeighborRecover(video: HTMLVideoElement, source: string, delayMs: number): void {
    if (neighborRecoverTimer != null) {
        window.clearTimeout(neighborRecoverTimer);
    }
    feedDbg('ios chain neighbor recover scheduled', { source, delayMs });
    neighborRecoverTimer = window.setTimeout(() => {
        neighborRecoverTimer = null;
        if (!detectPlatform().isIOS || readMutedPreference() || isUserHoldPause()) return;
        if (isProgPauseForVideo(video)) return;
        lastNeighborRecoverAt = Date.now();
        neighborRecoverBurst += 1;
        runNeighborRecover(video, source);
    }, delayMs);
}

/** 邻格 mount 等导致 active 意外 pause 后，走 muted bootstrap 有声续播 */
export function recoverIosActiveChainIfPaused(
    video: HTMLVideoElement,
    source: string,
): boolean {
    if (!detectPlatform().isIOS || readMutedPreference()) return false;
    if (isUserHoldPause()) return false;
    if (!video.paused || video.ended) return false;
    if (isProgPauseForVideo(video)) return false;

    const sinceUnmute = msSinceChainUnmute();
    if (sinceUnmute == null && !isIosChainWantPlay()) return false;
    if (sinceUnmute != null && sinceUnmute > 10_000) return false;

    const now = Date.now();
    if (now - neighborRecoverBurstAt > 3000) {
        neighborRecoverBurst = 0;
    }
    if (neighborRecoverBurst >= 6) return false;

    const elapsed = lastNeighborRecoverAt ? now - lastNeighborRecoverAt : Number.POSITIVE_INFINITY;
    const inUnmuteBounce = sinceUnmute != null && sinceUnmute < 1000;

    if (elapsed < 250 && !inUnmuteBounce) return false;

    if (lastNeighborRecoverAt > 0 && elapsed < 500 && inUnmuteBounce) {
        const retrySource =
            source === 'post-neighbor' || source === 'active-pause' ? 'unmute-bounce' : source;
        scheduleNeighborRecover(video, retrySource, 120);
        return true;
    }

    lastNeighborRecoverAt = now;
    neighborRecoverBurstAt = now;
    neighborRecoverBurst += 1;
    return runNeighborRecover(video, source);
}

export function bindIosActivePauseRecover(
    player: Player,
    isActive: () => boolean,
): () => void {
    if (!detectPlatform().isIOS || readMutedPreference()) return () => undefined;

    const video = player.video as HTMLVideoElement | undefined;
    if (!video) return () => undefined;

    const onPause = () => {
        if (!isActive()) return;
        recoverIosActiveChainIfPaused(video, 'active-pause');
    };

    const onStalled = () => {
        if (!isActive()) return;
        if (!video.paused) return;
        recoverIosActiveChainIfPaused(video, 'stalled');
    };

    video.addEventListener('pause', onPause);
    video.addEventListener('stalled', onStalled);
    return () => {
        video.removeEventListener('pause', onPause);
        video.removeEventListener('stalled', onStalled);
        if (neighborRecoverTimer != null) {
            window.clearTimeout(neighborRecoverTimer);
            neighborRecoverTimer = null;
        }
    };
}

export function bindIosChainPlayRetry(
    player: Player,
    shouldRetry: () => boolean,
): () => void {
    if (!detectPlatform().isIOS) return () => undefined;

    const video = player.video as HTMLVideoElement | undefined;
    if (!video) return () => undefined;

    const retry = () => {
        if (!shouldRetry()) return;
        if (!video.src && !video.querySelector('source')) return;
        feedDbg('ios chain retry', { readyState: video.readyState, paused: video.paused });
        playIosChainWithSound(video, 'retry');
    };

    video.addEventListener('canplay', retry);
    video.addEventListener('loadeddata', retry);

    return () => {
        video.removeEventListener('canplay', retry);
        video.removeEventListener('loadeddata', retry);
    };
}
