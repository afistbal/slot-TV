/** 隐藏 video 预热池：按 ep_id 保留，切条时复用，避免 cleanup 误 abort 目标条 */

type PrewarmEntry = {
    video: HTMLVideoElement;
    url: string;
};

const pool = new Map<number, PrewarmEntry>();

export function putPrewarmedVideo(epId: number, url: string, video: HTMLVideoElement): void {
    const prev = pool.get(epId);
    if (prev && prev.video !== video) {
        abortPrewarmElement(prev.video);
    }
    pool.set(epId, { video, url });
}

export function takePrewarmedVideo(epId: number, url: string): HTMLVideoElement | null {
    const entry = pool.get(epId);
    if (!entry || entry.url !== url) {
        return null;
    }
    pool.delete(epId);
    return entry.video;
}

export function hasPrewarmedVideo(epId: number, url: string): boolean {
    const entry = pool.get(epId);
    return Boolean(entry && entry.url === url && entry.video.readyState >= 1);
}

export function evictPrewarmExcept(keepEpIds: Set<number>): void {
    for (const [epId, entry] of pool) {
        if (!keepEpIds.has(epId)) {
            abortPrewarmElement(entry.video);
            pool.delete(epId);
        }
    }
}

function abortPrewarmElement(el: HTMLVideoElement): void {
    el.pause();
    el.removeAttribute('src');
    try {
        el.load();
    } catch {
        // ignore
    }
}
