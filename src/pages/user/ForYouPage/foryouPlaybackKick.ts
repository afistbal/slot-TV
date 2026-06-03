import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { preferForyouSoundAutoplay } from '@/pages/user/ForYouPage/foryouAutoplayPolicy';
import { hasVideoSessionUserUnmuted } from '@/pages/user/VideoPage/videoSessionMute';
import type { LoadEpisodeRuntime } from './forYouPlayerLoadEpisode';

export function foryouVideoSourcesMatch(el: HTMLVideoElement, urls: string[]): boolean {
    if (!urls.length) {
        return false;
    }
    const mounted = Array.from(el.querySelectorAll('source')).map((s) => s.getAttribute('src') ?? '');
    return (
        mounted.length >= urls.length && urls.every((u, idx) => mounted[idx] === u)
    );
}

/** 邻格 paused 已挂同源且已有当前帧数据 → 滑到该条可跳过整段 loadData */
export function canForyouWarmStart(el: HTMLVideoElement | null, urls: string[]): boolean {
    if (!el || !urls.length || !foryouVideoSourcesMatch(el, urls)) {
        return false;
    }
    return el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

export function applyForyouResumeSeek(
    el: HTMLVideoElement,
    resumeSec: number,
): void {
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

/** For You 起播（与 forYouPlayerLoadEpisode 内逻辑一致，供暖启动复用） */
export function kickForyouAutoplay(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    const isPcViewport =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    const sessionUnmuted = hasVideoSessionUserUnmuted();
    const isH5 = !isPcViewport;
    const isFeedColdAutoplay = Boolean(rt.isFeedColdAutoplay);
    const preferSoundAutoplay =
        preferForyouSoundAutoplay(isFeedColdAutoplay) ||
        (isH5 && sessionUnmuted && !isFeedColdAutoplay);
    const isColdVideoAutoplay = !preferSoundAutoplay;
    const showTapToUnmuteOnMutedAutoplay = isPcViewport && isFeedColdAutoplay;

    const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
    rt.legacyEpisodeAutoplayRef.current = false;

    if (location.search.indexOf('auto_play=0') !== -1) {
        el.muted = false;
        return;
    }

    const scheduleWhenBuffered = (run: () => void) => {
        if (rt.isForYouFeed && el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            el.addEventListener('canplay', run, { once: true });
            return;
        }
        run();
    };

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
        scheduleWhenBuffered(runLegacyPlay);
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
                rt.isForYouFeed &&
                isH5 &&
                sessionUnmuted &&
                !isFeedColdAutoplay &&
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
    const schedulePlay = () => scheduleWhenBuffered(runPlay);
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
