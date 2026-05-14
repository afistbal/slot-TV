/**
 * 从 `<video>` 截取当前帧为 JPEG data URL（管理员首帧队列等；分享与 `<video poster>` 用剧 `info.image`）。
 * **跨域 mp4 且未设 `video.crossOrigin='anonymous'`、CDN 未返回 CORS 时**，`drawImage`/`toDataURL` 会失败，返回 null（浏览器安全策略，不是逻辑 bug）。
 */
export function captureVideoFrameDataUrl(video: HTMLVideoElement, quality = 0.82): string | null {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
        return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }
    try {
        ctx.drawImage(video, 0, 0, w, h);
    } catch {
        return null;
    }
    try {
        return canvas.toDataURL('image/jpeg', quality);
    } catch {
        return null;
    }
}

/**
 * 在 `loadeddata` 后再尝试双 rAF、短暂 seek，提高「首帧已解码」时截到图的概率；
 * 仍受同源/CORS 限制，跨域无 CORS 时与 {@link captureVideoFrameDataUrl} 一样会失败。
 */
export async function captureVideoFrameDataUrlWithSeekRetry(
    video: HTMLVideoElement,
    quality = 0.82,
): Promise<string | null> {
    const shot = () => captureVideoFrameDataUrl(video, quality);
    let out = shot();
    if (out) {
        return out;
    }

    await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    out = shot();
    if (out) {
        return out;
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return null;
    }

    const restore = video.currentTime;
    const target = Math.min(0.05, Math.max(0.001, video.duration * 0.001));

    await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            window.clearTimeout(timer);
            resolve();
        };
        const timer = window.setTimeout(finish, 600);
        const onSeeked = () => finish();
        video.addEventListener('seeked', onSeeked, { once: true });
        try {
            video.currentTime = target;
        } catch {
            finish();
        }
    });

    out = shot();
    try {
        video.currentTime = restore;
    } catch {
        /* ignore */
    }
    return out;
}
