export type VideoOrientation = 'landscape' | 'portrait';

/** `loadedmetadata` 后根据编码分辨率判断横竖屏 */
export function readVideoOrientation(video: HTMLVideoElement): VideoOrientation | null {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
        return null;
    }
    if (w > h) {
        return 'landscape';
    }
    if (w < h) {
        return 'portrait';
    }
    return null;
}
