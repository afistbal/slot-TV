import {
    canNavigateBack,
    isDocumentReload,
} from './videoPlayerUtils';

const VIDEO_RELOAD_LANDING_KEY = 'video-reload-landing';

function isVideoSeriesPathname(pathname: string): boolean {
    return /^\/video\/\d+/.test(pathname);
}

/** 仅在 `/video/:id` F5：标记冷启动（首页等其它页 reload 不误伤站内跳转有声播） */
if (
    typeof window !== 'undefined' &&
    isDocumentReload() &&
    isVideoSeriesPathname(window.location.pathname)
) {
    try {
        sessionStorage.setItem(VIDEO_RELOAD_LANDING_KEY, '1');
    } catch {
        // ignore
    }
}

/** 本次文档加载后，剧集竖滑是否处于「F5 落页」的一次性冷启动 */
export function consumeVideoReloadLanding(): boolean {
    try {
        if (sessionStorage.getItem(VIDEO_RELOAD_LANDING_KEY) === '1') {
            sessionStorage.removeItem(VIDEO_RELOAD_LANDING_KEY);
            return true;
        }
    } catch {
        // ignore
    }
    return false;
}

/** 是否从站内首页/底栏等用户点击进入（有声、无冷启动蒙层） */
export function resolveVideoFromHomeVideoPlayback(locationState: unknown): boolean {
    if (
        Boolean(
            (locationState as { fromHomeVideoPlayback?: boolean } | null)?.fromHomeVideoPlayback,
        )
    ) {
        return true;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    return canNavigateBack();
}

/** 剧集竖滑首条是否静音冷启动（仅首条 load；滑切恒有声） */
export function isVideoSeriesColdAutoplay(
    fromHomeVideoPlayback: boolean,
    reloadLanding: boolean,
): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    if (reloadLanding) {
        return true;
    }
    if (fromHomeVideoPlayback) {
        return false;
    }
    return !canNavigateBack();
}

export function resolveVideoAllowSoundAutoplay(opts: {
    fromHomeVideoPlayback: boolean;
    marketingSoundQuery: boolean;
    isPcViewport: boolean;
    useLegacyEpisodePlayback: boolean;
    isVideoColdAutoplay: boolean;
    sessionUnmuted: boolean;
}): boolean {
    return (
        opts.fromHomeVideoPlayback ||
        !opts.isPcViewport ||
        opts.marketingSoundQuery ||
        (opts.isPcViewport && opts.useLegacyEpisodePlayback) ||
        (opts.isPcViewport && opts.sessionUnmuted && !opts.isVideoColdAutoplay)
    );
}

/** 在 Swiper mount 时算好 fromHome / 冷启动，避免 F5 残留 state 与 SPA 首页进入冲突 */
export function resolveVideoMountAutoplayFlags(locationState: unknown): {
    fromHomeVideoPlayback: boolean;
    videoColdAutoplay: boolean;
    reloadLanding: boolean;
} {
    const reloadLanding = consumeVideoReloadLanding();
    const fromHomeVideoPlayback = reloadLanding
        ? false
        : resolveVideoFromHomeVideoPlayback(locationState);
    const videoColdAutoplay = isVideoSeriesColdAutoplay(
        fromHomeVideoPlayback,
        reloadLanding,
    );
    return { fromHomeVideoPlayback, videoColdAutoplay, reloadLanding };
}
