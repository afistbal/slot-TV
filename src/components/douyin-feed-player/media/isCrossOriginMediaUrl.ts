/** MP4 MSE 分片走 fetch，跨域 CDN 无 CORS 时会失败；原生 video.src 不受此限 */
export function isCrossOriginMediaUrl(url: string): boolean {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
    try {
        const parsed = new URL(url, window.location.href);
        return parsed.origin !== window.location.origin;
    } catch {
        return false;
    }
}
