/**
 * 抖音H5-iOS播放适配分析.md §4.5 / pre-build-xgplayer L15682-15737
 * MSE 模式下检测 buffer gap，Safari 跳 gap 时多 +0.1s
 */
import { detectPlatform } from '../platform/detectPlatform';

const SMALL_GAP_LIMIT = 0.5;
const GAP_DETECTION_THRESHOLD = 0.3;
const BROWSER_GAP_TOLERANCE = 0.001;

function findGapIndex(buffered: TimeRanges, currentTime: number): number | null {
    for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);
        if (currentTime >= start && currentTime <= end) {
            if (i + 1 < buffered.length) {
                const nextStart = buffered.start(i + 1);
                if (nextStart - end > GAP_DETECTION_THRESHOLD) return i + 1;
            }
            return null;
        }
        if (currentTime < start && start - currentTime <= GAP_DETECTION_THRESHOLD) {
            return i;
        }
    }
    return null;
}

export function attachSafariGapJump(video: HTMLVideoElement): () => void {
    const { isG6Safari } = detectPlatform();
    let hasPlayed = false;
    let seekingEventReceived = false;

    const onGapJump = () => {
        if (video.readyState === HTMLMediaElement.HAVE_NOTHING) return;
        if (video.seeking && !seekingEventReceived) return;
        if (video.paused && video.currentTime !== 0 && hasPlayed) return;

        const idx = findGapIndex(video.buffered, video.currentTime);
        if (idx === null || idx === 0) return;

        const target = video.buffered.start(idx) + 0.1;
        if (target > video.duration) return;

        const gap = target - video.currentTime;
        if (gap >= BROWSER_GAP_TOLERANCE && gap <= SMALL_GAP_LIMIT) {
            video.currentTime = isG6Safari ? target + 0.1 : target;
        }
    };

    const onPlaying = () => {
        hasPlayed = true;
    };
    const onSeeking = () => {
        seekingEventReceived = true;
    };
    const onSeeked = () => {
        seekingEventReceived = false;
    };

    video.addEventListener('timeupdate', onGapJump);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);

    return () => {
        video.removeEventListener('timeupdate', onGapJump);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('seeking', onSeeking);
        video.removeEventListener('seeked', onSeeked);
    };
}
