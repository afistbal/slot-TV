import { resolveVideoAllowSoundAutoplay } from './videoAutoplayPolicy';
import { hasVideoSessionUserUnmuted } from './videoSessionMute';
import { isPerformanceNavigationReload } from './videoPlayerUtils';
import { SPEED } from './videoPlayerConstants';
import { resyncVideoSources } from './videoFeedMedia';
import { isVideoIosPlayback, kickVideoIosAutoplay } from './videoIosPlayback';
import type { LoadEpisodeRuntime } from './videoPlayerLoadEpisode';

/** H5 iOS 走专用 kick，其余走 kickVideoAutoplay */
export function kickVideoAutoplayForPlatform(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    const isPcViewport =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    if (rt.h5VerticalPlayback && isVideoIosPlayback() && !isPcViewport) {
        kickVideoIosAutoplay(rt, el);
        return;
    }
    kickVideoAutoplay(rt, el);
}

export function videoSourcesMatch(el: HTMLVideoElement, urls: string[]): boolean {
    if (!urls.length) {
        return false;
    }
    const mounted = Array.from(el.querySelectorAll('source')).map((s) => s.getAttribute('src') ?? '');
    return mounted.length >= urls.length && urls.every((u, idx) => mounted[idx] === u);
}

/** 邻格 paused 已挂同源且已有当前帧数据 → 滑到该集可跳过整段 loadData */
export function canVideoWarmStart(el: HTMLVideoElement | null, urls: string[]): boolean {
    if (!el || !urls.length || !videoSourcesMatch(el, urls)) {
        return false;
    }
    return el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

export function applyVideoResumeSeek(el: HTMLVideoElement, resumeSec: number): void {
    if (!(resumeSec > 0)) {
        return;
    }
    const apply = () => {
        const d = el.duration;
        const t =
            Number.isFinite(d) && d > 0
                ? Math.min(resumeSec, Math.max(0, d - 0.25))
                : resumeSec;
        if (Math.abs(el.currentTime - t) < 0.35) {
            return;
        }
        try {
            el.currentTime = t;
        } catch {
            // ignore seek before ready
        }
    };
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        apply();
    } else {
        el.addEventListener('loadedmetadata', apply, { once: true });
    }
}

function scheduleWhenBuffered(el: HTMLVideoElement, h5VerticalPlayback: boolean, run: () => void): void {
    if (h5VerticalPlayback && el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        el.addEventListener('canplay', run, { once: true });
        return;
    }
    run();
}

/** `/video` 起播（与 videoPlayerLoadEpisode 内逻辑一致，供暖启动复用） */
export function kickVideoAutoplay(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    const isPcViewport =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    const isReload = isPerformanceNavigationReload();
    const marketingSoundQuery =
        typeof location !== 'undefined' &&
        location.search.length > 1 &&
        location.search.indexOf('auto_play=0') === -1;
    const sessionUnmuted = hasVideoSessionUserUnmuted();
    const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
    rt.legacyEpisodeAutoplayRef.current = false;
    const isVideoColdAutoplay = Boolean(rt.isVideoColdAutoplay);
    const showTapToUnmutePc =
        isPcViewport &&
        !useLegacyEpisodePlayback &&
        (isVideoColdAutoplay ||
            isReload ||
            marketingSoundQuery ||
            (!rt.fromHomeVideoPlayback && (!sessionUnmuted || isReload)));
    const showTapToUnmuteOnMutedAutoplay = showTapToUnmutePc;
    const allowSoundAutoplay = resolveVideoAllowSoundAutoplay({
        fromHomeVideoPlayback: rt.fromHomeVideoPlayback,
        marketingSoundQuery,
        isPcViewport,
        useLegacyEpisodePlayback,
        isVideoColdAutoplay,
        sessionUnmuted,
    });
    const isColdVideoAutoplay = !allowSoundAutoplay;
    const h5Vertical = Boolean(rt.h5VerticalPlayback);

    if (location.search.indexOf('auto_play=0') !== -1) {
        el.muted = false;
        return;
    }

    if (useLegacyEpisodePlayback) {
        if (allowSoundAutoplay) {
            el.muted = false;
            rt.onVideoMutedUiSync?.(false);
        } else {
            el.muted = true;
            rt.onVideoMutedUiSync?.(true);
        }
        const runLegacyPlay = () => {
            const v = rt.videoRef.current;
            if (!v) {
                return;
            }
            v.play()
                .then(() => rt.setPlaying(true))
                .catch(() => {
                    if (allowSoundAutoplay && !v.muted) {
                        v.muted = true;
                        rt.onVideoMutedUiSync?.(true);
                        v.play()
                            .then(() => rt.setPlaying(true))
                            .catch(() => {
                                rt.showController(false);
                                rt.setWaiting(false);
                                rt.setCanPlay(true);
                            });
                        return;
                    }
                    rt.showController(false);
                    rt.setWaiting(false);
                    rt.setCanPlay(true);
                });
        };
        scheduleWhenBuffered(el, h5Vertical, runLegacyPlay);
        return;
    }

    if (allowSoundAutoplay) {
        el.muted = false;
        rt.onVideoMutedUiSync?.(false);
    } else {
        el.muted = true;
        rt.onVideoMutedUiSync?.(true);
        rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
    }

    const runPlay = () => {
        const v = rt.videoRef.current;
        if (!v) {
            return;
        }
        const onPlayFail = () => {
            rt.showController(false);
            rt.setWaiting(false);
            rt.setCanPlay(true);
            if (!(isPcViewport && v.muted && showTapToUnmuteOnMutedAutoplay)) {
                rt.setShowTapToUnmute(false);
            }
        };
        v.play()
            .then(() => rt.setPlaying(true))
            .catch(() => {
                if (allowSoundAutoplay && !v.muted) {
                    v.muted = true;
                    rt.onVideoMutedUiSync?.(true);
                    rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
                    v.play()
                        .then(() => rt.setPlaying(true))
                        .catch(onPlayFail);
                    return;
                }
                onPlayFail();
            });
    };

    const delayMs = isPcViewport && isColdVideoAutoplay ? 300 : 0;
    const schedulePlay = () => scheduleWhenBuffered(el, h5Vertical, runPlay);
    if (delayMs > 0) {
        rt.autoplayKickTimerRef.current = setTimeout(schedulePlay, delayMs);
    } else {
        schedulePlay();
    }

    window.clearTimeout(rt.controllerTimerRef.current);
    rt.controllerTimerRef.current = window.setTimeout(() => {
        rt.hideController();
    }, 10000);
}

/** H5 邻格升当前集：同源且已有帧数据时跳过 fetch/reload，直接续播 */
export function tryVideoWarmStartPlayback(
    rt: LoadEpisodeRuntime,
    episodeId: number,
    urls: string[],
    cachedEpisodeId: number | undefined,
): boolean {
    if (rt.suppressPlayback || cachedEpisodeId !== episodeId) {
        return false;
    }
    const el = rt.videoRef.current;
    if (!canVideoWarmStart(el, urls)) {
        return false;
    }
    if (rt.shouldAbort?.() || !el) {
        return false;
    }
    const resumeSec =
        rt.resumeTimeSec != null && rt.resumeTimeSec > 0 ? rt.resumeTimeSec : 0;
    if (resumeSec > 0) {
        applyVideoResumeSeek(el, resumeSec);
    }
    el.playbackRate = SPEED[rt.speed];
    if (urls.length > 0) {
        resyncVideoSources(el, urls);
    }
    rt.setLoading(false);
    rt.setCanPlay(true);
    kickVideoAutoplayForPlatform(rt, el);
    return true;
}
