import {
    canNavigateBack,
    isDocumentReload,
} from './videoPlayerUtils';

import type { ForYouToVideoLocationState } from '@/constants/foryouRoute';

const VIDEO_RELOAD_LANDING_KEY = 'video-reload-landing';

function isVideoSeriesPathname(pathname: string): boolean {
    return /^\/video\/\d+/.test(pathname);
}

/** 模块 init：F5 落在 `/video` 时标记（mount 时一次性消费，对标 For You） */
let videoReloadLandingPending = false;

if (
    typeof window !== 'undefined' &&
    isDocumentReload() &&
    isVideoSeriesPathname(window.location.pathname)
) {
    videoReloadLandingPending = true;
    try {
        sessionStorage.setItem(VIDEO_RELOAD_LANDING_KEY, '1');
    } catch {
        // ignore
    }
}

/** Swiper 首次 mount 结果缓存（同文档内 remount / 多实例复用，避免重复 consume） */
let cachedVideoMountAutoplayFlags: {
    fromHomeVideoPlayback: boolean;
    videoColdAutoplay: boolean;
    reloadLanding: boolean;
} | null = null;

/** 离开 `/video` 路由后清 mount 缓存 */
export function resetVideoMountAutoplayCache(): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (!isVideoSeriesPathname(window.location.pathname)) {
        cachedVideoMountAutoplayFlags = null;
    }
}

function consumeVideoReloadLanding(): boolean {
    if (videoReloadLandingPending) {
        videoReloadLandingPending = false;
        try {
            sessionStorage.removeItem(VIDEO_RELOAD_LANDING_KEY);
        } catch {
            // ignore
        }
        return true;
    }
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

function hasExplicitInAppNavigationState(locationState: unknown): boolean {
    const state = locationState as ForYouToVideoLocationState | null;
    return Boolean(state?.fromForYouPlayback || state?.fromHomeVideoPlayback);
}

/** 是否从站内首页/底栏/For You 等用户点击进入（有声、无冷启动蒙层） */
export function resolveVideoFromHomeVideoPlayback(locationState: unknown): boolean {
    const state = locationState as ForYouToVideoLocationState | null;
    if (state?.fromHomeVideoPlayback) {
        return true;
    }
    if (state?.fromForYouPlayback) {
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

/** 首条是否应优先「有声」自动播（与 `isVideoSeriesColdAutoplay` 互斥，对标 For You） */
export function preferVideoSoundAutoplay(isVideoColdAutoplay: boolean): boolean {
    return !isVideoColdAutoplay;
}

export function resolveVideoAllowSoundAutoplay(opts: {
    fromHomeVideoPlayback: boolean;
    marketingSoundQuery: boolean;
    isPcViewport: boolean;
    useLegacyEpisodePlayback: boolean;
    isVideoColdAutoplay: boolean;
    sessionUnmuted: boolean;
}): boolean {
    if (opts.fromHomeVideoPlayback) {
        return true;
    }
    if (opts.isVideoColdAutoplay) {
        return false;
    }
    if (opts.marketingSoundQuery) {
        return true;
    }
    if (opts.isPcViewport && opts.useLegacyEpisodePlayback) {
        return true;
    }
    if (opts.isPcViewport && opts.sessionUnmuted) {
        return true;
    }
    if (!opts.isPcViewport) {
        return true;
    }
    return false;
}

function computeVideoMountAutoplayFlags(locationState: unknown): {
    fromHomeVideoPlayback: boolean;
    videoColdAutoplay: boolean;
    reloadLanding: boolean;
} {
    const reloadLanding = consumeVideoReloadLanding();
    if (reloadLanding) {
        return {
            fromHomeVideoPlayback: false,
            videoColdAutoplay: true,
            reloadLanding: true,
        };
    }
    if (hasExplicitInAppNavigationState(locationState)) {
        return {
            fromHomeVideoPlayback: true,
            videoColdAutoplay: false,
            reloadLanding: false,
        };
    }
    const fromHomeVideoPlayback = resolveVideoFromHomeVideoPlayback(locationState);
    const videoColdAutoplay = isVideoSeriesColdAutoplay(fromHomeVideoPlayback, false);
    return { fromHomeVideoPlayback, videoColdAutoplay, reloadLanding: false };
}

/** 在 Swiper mount 时算好 fromHome / 冷启动（对标 `resolveForyouMountAutoplayFlags`） */
export function resolveVideoMountAutoplayFlags(locationState: unknown): {
    fromHomeVideoPlayback: boolean;
    videoColdAutoplay: boolean;
    reloadLanding: boolean;
} {
    if (cachedVideoMountAutoplayFlags !== null) {
        return cachedVideoMountAutoplayFlags;
    }
    cachedVideoMountAutoplayFlags = computeVideoMountAutoplayFlags(locationState);
    return cachedVideoMountAutoplayFlags;
}
