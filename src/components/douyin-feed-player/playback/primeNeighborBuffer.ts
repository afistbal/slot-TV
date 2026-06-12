/**
 * 对标 slot-TV primeForyouNeighborBuffer：邻格 paused + preload=auto + load()，不 play
 */
import type Player from 'xgplayer';

import { feedDbg } from '../feed/feedDebugLog';
import { readMutedPreference } from '../controls/mutePreference';
import { resumeNativeVideo } from './suspendNativeVideo';

export function primeDouyinNeighborBuffer(player: Player, url: string): void {
    const video = player.video as HTMLVideoElement | undefined;
    if (!video || !url) return;

    video.preload = 'auto';
    const currentSrc = video.getAttribute('src') || video.src || '';

    if (!currentSrc) {
        resumeNativeVideo(video, url, {
            autoplay: false,
            muted: readMutedPreference(),
        });
        feedDbg('neighbor buffer resume', { readyState: video.readyState });
        return;
    }

    if (
        video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
        video.networkState !== HTMLMediaElement.NETWORK_LOADING
    ) {
        try {
            video.load();
        } catch {
            /* ignore */
        }
    }

    feedDbg('neighbor buffer prime', {
        readyState: video.readyState,
        networkState: video.networkState,
    });
}

const INTERVAL_MS = 1500;

/** 当前条播放期间补 prime 下一邻格，直到 rs≥4 */
export function attachActiveNeighborPrime(
    getActiveIndex: () => number,
    getNextNeighbor: (activeIndex: number) => { player: Player; url: string } | null,
): () => void {
    let lastAt = 0;

    const tick = (force = false) => {
        const neighbor = getNextNeighbor(getActiveIndex());
        if (!neighbor?.url) return;

        const video = neighbor.player.video as HTMLVideoElement | undefined;
        if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            return;
        }

        const now = Date.now();
        if (!force && now - lastAt < INTERVAL_MS) return;
        lastAt = now;
        primeDouyinNeighborBuffer(neighbor.player, neighbor.url);
    };

    tick(true);
    const timer = window.setInterval(() => tick(false), INTERVAL_MS);
    return () => window.clearInterval(timer);
}
