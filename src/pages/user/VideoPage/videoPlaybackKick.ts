import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { preferVideoSoundAutoplay } from './videoAutoplayPolicy';
import { hasVideoSessionUserUnmuted } from './videoSessionMute';
import { applyVideoPlaybackRate } from './videoPlayerConstants';
import { resyncVideoSources } from './videoFeedMedia';
import { ensureVideoIosVideoLoad, isVideoIosPlayback, kickVideoIosAutoplay } from './videoIosPlayback';
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

/** 邻格 paused 已挂同源且已有可播数据 → 滑到该集可跳过整段 loadData */
export function canVideoWarmStart(
    el: HTMLVideoElement | null,
    urls: string[],
    swipeAutoplay = false,
): boolean {
    if (!el || !urls.length || !videoSourcesMatch(el, urls)) {
        return false;
    }
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        return true;
    }
    return swipeAutoplay && el.readyState >= HTMLMediaElement.HAVE_METADATA;
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

/** `/video` 起播（对标 `kickForyouAutoplay`） */
export function kickVideoAutoplay(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    const isPcViewport =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    const marketingSoundQuery =
        typeof location !== 'undefined' &&
        location.search.length > 1 &&
        location.search.indexOf('auto_play=0') === -1;
    const sessionUnmuted = hasVideoSessionUserUnmuted();
    const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
    rt.legacyEpisodeAutoplayRef.current = false;
    const isVideoColdAutoplay = Boolean(rt.isVideoColdAutoplay);
    const isH5 = !isPcViewport;
    const preferSoundAutoplay =
        preferVideoSoundAutoplay(isVideoColdAutoplay) ||
        (isH5 && sessionUnmuted && !isVideoColdAutoplay) ||
        (isPcViewport &&
            (rt.fromHomeVideoPlayback ||
                marketingSoundQuery ||
                useLegacyEpisodePlayback ||
                (sessionUnmuted && !isVideoColdAutoplay)));
    const isColdVideoAutoplay = !preferSoundAutoplay;
    /** H5 蒙层由 VideoPlayer `videoColdUnmuteOverlay`；PC 仍用 kick 内 showTapToUnmute */
    const showTapToUnmuteOnMutedAutoplay =
        isPcViewport && !useLegacyEpisodePlayback && isVideoColdAutoplay;
    const h5Vertical = Boolean(rt.h5VerticalPlayback);

    if (location.search.indexOf('auto_play=0') !== -1) {
        el.muted = false;
        return;
    }

    if (useLegacyEpisodePlayback) {
        if (preferSoundAutoplay) {
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
                    if (preferSoundAutoplay && !v.muted) {
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

    if (preferSoundAutoplay) {
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
        const fallbackMutedAutoplay = () => {
            if (
                isH5 &&
                rt.fromHomeVideoPlayback &&
                !isVideoColdAutoplay &&
                sessionUnmuted &&
                !isIosLikeDevice()
            ) {
                onPlayFail();
                return;
            }
            v.muted = true;
            rt.onVideoMutedUiSync?.(true);
            rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
            v.play()
                .then(() => rt.setPlaying(true))
                .catch(onPlayFail);
        };
        v.play()
            .then(() => rt.setPlaying(true))
            .catch(() => {
                if (preferSoundAutoplay && !v.muted) {
                    fallbackMutedAutoplay();
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
    if (rt.suppressPlayback || Boolean(rt.isVideoColdAutoplay)) {
        return false;
    }
    if (cachedEpisodeId != null && cachedEpisodeId !== episodeId) {
        return false;
    }
    const el = rt.videoRef.current;
    const swipeAutoplay = rt.legacyEpisodeAutoplayRef.current;
    if (!canVideoWarmStart(el, urls, swipeAutoplay)) {
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
    if (urls.length > 0 && !videoSourcesMatch(el, urls)) {
        resyncVideoSources(el, urls);
    }
    if (isVideoIosPlayback()) {
        ensureVideoIosVideoLoad(el);
    }
    applyVideoPlaybackRate(el, rt.speedRef.current);
    rt.setLoading(false);
    rt.setCanPlay(true);
    if (location.search.indexOf('auto_play=0') === -1) {
        const isPcViewport =
            typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
        if (rt.h5VerticalPlayback && isVideoIosPlayback() && !isPcViewport) {
            kickVideoIosAutoplay(rt, el);
        } else {
            kickVideoAutoplayForPlatform(rt, el);
        }
    }
    return true;
}
