/**
 * 跨路由续播（如 For You → `/video`）写入 sessionStorage 的 key 前缀。
 * 写入方在 ForYou 模块；此处仅读取，避免 Video 依赖 ForYou 包。
 */
const VIDEO_CROSS_ROUTE_RESUME_PREFIX = 'foryou-resume:';

function crossRouteResumeKey(movieId: number, episodeRowId: number): string {
    return `${VIDEO_CROSS_ROUTE_RESUME_PREFIX}${movieId}:${episodeRowId}`;
}

/** 读取并清除跨路由续播进度（秒） */
export function consumeVideoCrossRouteResumeSec(
    movieId: number,
    episodeRowId: number,
): number | undefined {
    if (typeof sessionStorage === 'undefined') {
        return undefined;
    }
    const key = crossRouteResumeKey(movieId, episodeRowId);
    const raw = sessionStorage.getItem(key);
    if (raw == null) {
        return undefined;
    }
    sessionStorage.removeItem(key);
    const t = Number.parseFloat(raw);
    if (!Number.isFinite(t) || t <= 0) {
        return undefined;
    }
    return t;
}
