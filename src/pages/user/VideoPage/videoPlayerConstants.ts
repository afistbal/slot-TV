export const SPEED = [0.75, 1.0, 1.25, 1.5, 2.0];

/** 默认 1.0x（For You 等不可调速场景固定使用） */
export const DEFAULT_PLAYBACK_SPEED_INDEX = 1;

export type ShareAction = 'facebook' | 'twitter' | 'link' | 'embed';

export function readStoredPlaybackSpeedIndex(): number {
    if (typeof localStorage === 'undefined') {
        return 1;
    }
    const n = parseInt(localStorage.getItem('playback_speed') || '1', 10);
    if (!Number.isFinite(n) || n < 0 || n >= SPEED.length) {
        return 1;
    }
    return n;
}

export function writeStoredPlaybackSpeedIndex(index: number): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    const safe =
        Number.isFinite(index) && index >= 0 && index < SPEED.length ? index : 1;
    localStorage.setItem('playback_speed', String(safe));
}

export function applyVideoPlaybackRate(
    el: HTMLVideoElement | null | undefined,
    speedIndex: number,
): void {
    if (!el) {
        return;
    }
    const rate = SPEED[speedIndex];
    if (typeof rate === 'number' && Number.isFinite(rate)) {
        el.playbackRate = rate;
    }
}
