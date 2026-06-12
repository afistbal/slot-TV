/** DEV：区分代码 play/pause vs 浏览器/用户原生事件，避免日志误判 */

let lastProgPauseAt = 0;
let lastProgPauseKeepScheduled = false;
let lastProgPauseVideo: HTMLVideoElement | null = null;
let lastCodedPlayAt = 0;
let lastCodedPlaySource = '';
let lastChainUnmuteAt = 0;
let lastNeighborMountAt = 0;
let lastNeighborMountIndex = -1;

const PROG_PAUSE_MS = 200;
const CODED_PLAY_MS = 800;

export function markProgPause(video: HTMLVideoElement | null | undefined, keepScheduled: boolean) {
    lastProgPauseAt = Date.now();
    lastProgPauseKeepScheduled = keepScheduled;
    lastProgPauseVideo = video ?? null;
}

export function isProgPauseForVideo(video: HTMLVideoElement): boolean {
    return (
        isRecentProgPause() &&
        lastProgPauseVideo != null &&
        lastProgPauseVideo === video
    );
}

export function markCodedPlay(source: string) {
    lastCodedPlayAt = Date.now();
    lastCodedPlaySource = source;
}

export function markChainUnmute() {
    lastChainUnmuteAt = Date.now();
}

export function markNeighborMount(index: number) {
    lastNeighborMountAt = Date.now();
    lastNeighborMountIndex = index;
}

export function msSinceProgPause(): number | null {
    return lastProgPauseAt ? Date.now() - lastProgPauseAt : null;
}

export function msSinceCodedPlay(): number | null {
    return lastCodedPlayAt ? Date.now() - lastCodedPlayAt : null;
}

export function isRecentProgPause(): boolean {
    return Boolean(lastProgPauseAt && Date.now() - lastProgPauseAt < PROG_PAUSE_MS);
}

export function isRecentCodedPlay(): boolean {
    return Boolean(lastCodedPlayAt && Date.now() - lastCodedPlayAt < CODED_PLAY_MS);
}

export function recentCodedPlaySource(): string {
    return lastCodedPlaySource;
}

export function recentNeighborMount(): { index: number; msAgo: number } | null {
    if (!lastNeighborMountAt) return null;
    return { index: lastNeighborMountIndex, msAgo: Date.now() - lastNeighborMountAt };
}

export function msSinceChainUnmute(): number | null {
    return lastChainUnmuteAt ? Date.now() - lastChainUnmuteAt : null;
}
