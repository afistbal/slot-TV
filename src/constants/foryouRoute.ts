/** For You 页路由（H5 底栏、PC 顶栏统一） */
export const FORYOU_PATH = '/foryou';

export function isForYouPathname(pathname: string): boolean {
    return pathname === FORYOU_PATH || pathname.startsWith(`${FORYOU_PATH}/`);
}

/** 从 For You 进 `/video` 时携带的播放进度（秒） */
export type ForYouToVideoLocationState = {
    fromForYouPlayback?: boolean;
    fromHomeVideoPlayback?: boolean;
    resumeTime?: number;
    episodeRowId?: number;
};

export const FORYOU_RESUME_STORAGE_PREFIX = 'foryou-resume:';

export function forYouResumeStorageKey(movieId: number, episodeRowId: number): string {
    return `${FORYOU_RESUME_STORAGE_PREFIX}${movieId}:${episodeRowId}`;
}

/** 从 For You 进 /video：优先 location.state，否则读 sessionStorage 并清除 */
export function resolveForyouIncomingResumeSec(
    movieId: number,
    episodeRowId: number,
    locationState: unknown,
): number | undefined {
    const st = (locationState ?? null) as ForYouToVideoLocationState | null;
    if (
        st?.fromForYouPlayback &&
        st.episodeRowId === episodeRowId &&
        typeof st.resumeTime === 'number' &&
        st.resumeTime > 0
    ) {
        return st.resumeTime;
    }
    return consumeForyouResumeTimeSec(movieId, episodeRowId);
}

/** 从 For You 进 video 时读取并清除续播进度（秒） */
export function consumeForyouResumeTimeSec(movieId: number, episodeRowId: number): number | undefined {
    if (typeof sessionStorage === 'undefined') {
        return undefined;
    }
    const key = forYouResumeStorageKey(movieId, episodeRowId);
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
