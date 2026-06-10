/**
 * 抖音H5-iOS播放适配分析.md §7.4
 * 对标 player-9 _onWaiting / _loadStuckCheck
 */
import {
    WAITING_IN_BUFFER_MS,
    WAIT_JAMP_BUFFER_MAX_CNT,
    WAITING_STUCK_MS,
} from '../constants';

export type AntiStallHandlers = {
    onDegradeToNative: (currentTime: number) => void;
    onStall?: (reason: string) => void;
    waitingInBufferMs?: number;
    stuckTimeoutMs?: number;
    maxMicroSeek?: number;
};

export function attachIOSAntiStall(
    video: HTMLVideoElement,
    handlers: AntiStallHandlers,
): () => void {
    const waitingMs = handlers.waitingInBufferMs ?? WAITING_IN_BUFFER_MS;
    const stuckMs = handlers.stuckTimeoutMs ?? WAITING_STUCK_MS;
    const maxSeek = handlers.maxMicroSeek ?? WAIT_JAMP_BUFFER_MAX_CNT;

    let waitTimer: ReturnType<typeof setTimeout> | null = null;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    let seekCount = 0;
    let lastTime = 0;

    const bufferedAhead = () => {
        const t = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
            const start = video.buffered.start(i);
            const end = video.buffered.end(i);
            if (t >= start && t <= end) return end - t;
        }
        return 0;
    };

    const clearAll = () => {
        if (waitTimer) clearTimeout(waitTimer);
        if (stuckTimer) clearTimeout(stuckTimer);
        waitTimer = stuckTimer = null;
    };

    const onWaiting = () => {
        clearAll();
        const ahead = bufferedAhead();
        if (ahead >= 2) {
            if (seekCount < maxSeek) {
                waitTimer = setTimeout(() => {
                    seekCount++;
                    handlers.onStall?.('waiting_in_buffer_micro_seek');
                    video.currentTime += 0.5;
                }, waitingMs);
            } else {
                handlers.onStall?.('wait_timeout_in_buffer');
                handlers.onDegradeToNative(video.currentTime);
            }
        } else {
            stuckTimer = setTimeout(() => {
                if (video.currentTime - lastTime < 0.1) {
                    handlers.onStall?.('stuck_timeout');
                    handlers.onDegradeToNative(video.currentTime);
                }
            }, stuckMs);
        }
    };

    const onPlaying = () => {
        seekCount = 0;
        clearAll();
    };

    const onTimeUpdate = () => {
        lastTime = video.currentTime;
    };

    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
        clearAll();
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('timeupdate', onTimeUpdate);
    };
}
