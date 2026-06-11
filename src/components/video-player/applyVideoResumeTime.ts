/** 在 `loadedmetadata` 后写入续播进度，避免片源未就绪时 seek 失败 */
export function applyVideoResumeTime(el: HTMLVideoElement, resumeTimeSec: number): void {
    const seek = () => {
        if (!Number.isFinite(resumeTimeSec) || resumeTimeSec <= 0) {
            return;
        }
        const max = el.duration;
        if (Number.isFinite(max) && max > 0) {
            el.currentTime = Math.min(resumeTimeSec, Math.max(0, max - 0.25));
        } else {
            el.currentTime = resumeTimeSec;
        }
    };
    if (el.readyState >= 1) {
        seek();
        return;
    }
    el.addEventListener('loadedmetadata', seek, { once: true });
}
