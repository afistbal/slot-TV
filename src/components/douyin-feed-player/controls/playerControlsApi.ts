import type Player from 'xgplayer';

import { PLAYBACK_SPEEDS } from '../constants';
import { lockUserAudio, markUserGesture, unlockUserAudio } from '../feed/userGesturePlay';
import { cancelScheduledActivePlay, setUserHoldPause } from '../player/createXgPlayer';
import { resolveFeedSlideEl } from './resolveFeedSlideEl';
import { writeMutedPreference } from './mutePreference';
import { writeSpeedIndexPreference } from './speedPreference';

type XgPlayerLike = Player & {
    paused?: boolean;
    muted?: boolean;
    playbackRate?: number;
    currentTime?: number;
    duration?: number;
    getFullscreen?: (el?: HTMLElement) => Promise<void>;
    exitFullscreen?: (el?: HTMLElement) => Promise<void>;
};

export function getVideoEl(player: Player | null): HTMLVideoElement | null {
    if (!player?.video) return null;
    return player.video as HTMLVideoElement;
}

export function asXgPlayer(player: Player | null): XgPlayerLike | null {
    return player as XgPlayerLike | null;
}

export function formatPlaybackTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function isPlayerPaused(player: Player | null): boolean {
    const video = getVideoEl(player);
    if (video) return video.paused;
    return asXgPlayer(player)?.paused ?? true;
}

export function isPlayerMuted(player: Player | null): boolean {
    const video = getVideoEl(player);
    return video?.muted ?? true;
}

export async function togglePlayerPlay(player: Player | null): Promise<boolean> {
    if (!player) return false;
    markUserGesture();
    if (isPlayerPaused(player)) {
        setUserHoldPause(false);
        cancelScheduledActivePlay();
        await player.play().catch(() => undefined);
        return true;
    }
    setUserHoldPause(true);
    cancelScheduledActivePlay();
    player.pause();
    return false;
}

export function togglePlayerMute(player: Player | null): boolean {
    const video = getVideoEl(player);
    if (!video) return true;
    markUserGesture();
    cancelScheduledActivePlay();
    const next = !video.muted;
    video.muted = next;
    if (!next && video.volume === 0) {
        video.volume = 0.5;
    }
    const xg = asXgPlayer(player);
    if (xg) xg.muted = next;
    writeMutedPreference(next);
    if (next) lockUserAudio();
    else unlockUserAudio();
    return next;
}

export function applyPlayerMute(player: Player | null, muted: boolean): void {
    const video = getVideoEl(player);
    if (!video) return;
    video.muted = muted;
    const xg = asXgPlayer(player);
    if (xg) xg.muted = muted;
}

export function applyPlaybackSpeed(player: Player | null, speedIndex: number): number {
    const rate = PLAYBACK_SPEEDS[speedIndex] ?? 1;
    const video = getVideoEl(player);
    if (video) video.playbackRate = rate;
    const xg = asXgPlayer(player);
    if (xg) xg.playbackRate = rate;
    writeSpeedIndexPreference(speedIndex);
    return rate;
}

export function cyclePlaybackSpeedIndex(current: number): number {
    return (current + 1) % PLAYBACK_SPEEDS.length;
}

export async function togglePlayerFullscreen(
    player: Player | null,
    target?: HTMLElement | null,
): Promise<boolean> {
    const xg = asXgPlayer(player);
    if (!xg) return false;
    const fsEl = document.fullscreenElement;
    if (fsEl) {
        await xg.exitFullscreen?.().catch(() => document.exitFullscreen().catch(() => undefined));
        return false;
    }
    const el = target ?? resolveFeedSlideEl(player);
    await xg.getFullscreen?.(el ?? undefined).catch(() => undefined);
    return Boolean(document.fullscreenElement);
}

export function getPlayerCurrentTime(player: Player | null): number {
    const video = getVideoEl(player);
    if (video) return video.currentTime;
    return Number(asXgPlayer(player)?.currentTime) || 0;
}

export function getPlayerDuration(player: Player | null): number {
    const video = getVideoEl(player);
    if (video && Number.isFinite(video.duration)) return video.duration;
    return Number(asXgPlayer(player)?.duration) || 0;
}

export function seekPlayer(player: Player | null, ratio: number): void {
    const xg = asXgPlayer(player);
    if (!xg) return;
    const duration = getPlayerDuration(player);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const next = Math.min(Math.max(0, ratio), 1) * duration;
    const video = getVideoEl(player);
    if (video) video.currentTime = next;
    xg.currentTime = next;
}
