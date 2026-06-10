/**
 * 抖音H5-iOS播放适配分析.md §3.1 / player-9 L1551-1570
 * resumePlayWaterLevel：前方缓冲不足时主动 pause，恢复后再 play
 */
import { RESUME_PLAY_WATER_LEVEL } from '../constants';
import { detectPlatform } from '../platform/detectPlatform';

const STARTUP_GRACE_MS = detectPlatform().isIOS ? 6000 : 4000;

export function attachBufferWaterLevel(
    video: HTMLVideoElement,
    waterLevel = RESUME_PLAY_WATER_LEVEL,
): () => void {
    let isBufferControlPaused = false;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let firstPlayingAt = 0;

    const getBufferedEnd = (): number => {
        const t = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
            const start = video.buffered.start(i);
            const end = video.buffered.end(i);
            if (t >= start && t <= end) return end;
        }
        return video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
    };

    const clearCheckTimer = () => {
        if (checkTimer) {
            clearTimeout(checkTimer);
            checkTimer = null;
        }
    };

    const onPlaying = () => {
        if (!firstPlayingAt) firstPlayingAt = Date.now();
        clearCheckTimer();

        if (Date.now() - firstPlayingAt < STARTUP_GRACE_MS) return;

        const dur = video.duration;
        // 抖音 player-9 L1560：距片尾 ≤ resumePlayWaterLevel 时跳过水位 pause，正常播完
        if (Number.isFinite(dur) && dur > 0 && dur - video.currentTime <= waterLevel) {
            return;
        }

        const bufEnd = getBufferedEnd();
        if (bufEnd > 0 && bufEnd - video.currentTime < waterLevel) {
            if (!video.paused) {
                isBufferControlPaused = true;
                video.pause();
            }
            checkTimer = setTimeout(onPlaying, (waterLevel / 2) * 1000);
        } else if (isBufferControlPaused && video.paused) {
            isBufferControlPaused = false;
            video.play().catch(() => undefined);
        }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onPlaying);

    return () => {
        clearCheckTimer();
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('timeupdate', onPlaying);
    };
}
