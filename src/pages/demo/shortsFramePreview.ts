/**
 * 离屏解码到首帧（loadeddata）后抽一帧为 JPEG Blob URL，不用于真实播放；随后卸掉 video。
 * 跨域直链需 CDN 返回 `Access-Control-Allow-Origin`，否则 canvas 无法导出（返回 null）。
 */
export function captureVideoFirstFrameObjectUrl(
    url: string,
    options?: { maxWaitMs?: number; targetMaxEdge?: number; jpegQuality?: number },
): Promise<string | null> {
    const maxWaitMs = options?.maxWaitMs ?? 8000;
    const targetMaxEdge = options?.targetMaxEdge ?? 540;
    const jpegQuality = options?.jpegQuality ?? 0.72;

    if (!url) {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const v = document.createElement('video');
        v.muted = true;
        v.defaultMuted = true;
        v.crossOrigin = 'anonymous';
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.preload = 'auto';
        v.style.cssText =
            'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;visibility:hidden';

        let settled = false;
        const settle = (blobUrl: string | null) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(tid);
            v.removeEventListener('loadeddata', onLoadedData);
            v.removeEventListener('error', onError);
            try {
                v.pause();
                v.removeAttribute('src');
                v.load();
            } catch {
                /* ignore */
            }
            v.remove();
            resolve(blobUrl);
        };

        const draw = () => {
            try {
                const vw = v.videoWidth;
                const vh = v.videoHeight;
                if (!vw || !vh) {
                    settle(null);
                    return;
                }
                let w = vw;
                let h = vh;
                if (Math.max(w, h) > targetMaxEdge) {
                    const scale = targetMaxEdge / Math.max(w, h);
                    w = Math.round(vw * scale);
                    h = Math.round(vh * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    settle(null);
                    return;
                }
                ctx.drawImage(v, 0, 0, w, h);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            settle(null);
                            return;
                        }
                        settle(URL.createObjectURL(blob));
                    },
                    'image/jpeg',
                    jpegQuality,
                );
            } catch {
                settle(null);
            }
        };

        const onLoadedData = () => {
            v.pause();
            requestAnimationFrame(() => draw());
        };

        const onError = () => {
            settle(null);
        };

        const tid = window.setTimeout(() => settle(null), maxWaitMs);

        v.addEventListener('loadeddata', onLoadedData, { once: true });
        v.addEventListener('error', onError, { once: true });

        v.src = url;
        v.load();
        void v.play().catch(() => {
            /* 部分环境禁止 play；仍可能触发 loadeddata */
        });
    });
}
