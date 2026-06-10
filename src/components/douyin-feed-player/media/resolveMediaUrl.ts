/**
 * 将 API 返回的相对 video 路径拼成可播放的绝对 URL。
 * 逻辑对齐：video 字段 + config.static（与业务 resolveEpisodePlaybackUrls 一致）。
 */
export function resolveMediaUrl(raw: string, mediaBaseUrl: string): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;

    const base = String(mediaBaseUrl ?? '').replace(/\/+$/, '');
    if (!base) return s;

    return `${base}/${s.replace(/^\/+/, '')}`;
}

export function resolveMediaUrls(rawList: string[], mediaBaseUrl: string): string[] {
    return rawList.map((raw) => resolveMediaUrl(raw, mediaBaseUrl)).filter(Boolean);
}
