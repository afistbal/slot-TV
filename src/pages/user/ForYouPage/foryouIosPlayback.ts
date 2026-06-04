import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { preferForyouSoundAutoplay } from '@/pages/user/ForYouPage/foryouAutoplayPolicy';
import type { LoadEpisodeRuntime } from '@/pages/user/ForYouPage/forYouPlayerLoadEpisode';
import {
    getForyouPlayerMuted,
    setForyouPlayerMuted,
} from '@/pages/user/VideoPage/videoSessionMute';

/** 仅 For You iOS H5 启用；Android / PC 不得调用本模块起播 */
export function isForyouIosPlayback(): boolean {
    return isIosLikeDevice();
}

/** 底栏点 For You：在手势链内置位，供首条 loadData 消费一次 */
let foryouIosTabGestureUntilMs = 0;

export function markForyouIosTabGesture(): void {
    if (!isForyouIosPlayback()) {
        return;
    }
    foryouIosTabGestureUntilMs = Date.now() + 1500;
}

export function consumeForyouIosTabGesture(): boolean {
    if (!isForyouIosPlayback()) {
        return false;
    }
    if (Date.now() > foryouIosTabGestureUntilMs) {
        foryouIosTabGestureUntilMs = 0;
        return false;
    }
    foryouIosTabGestureUntilMs = 0;
    return true;
}

export function safeForyouIosPlay(video: HTMLVideoElement): void {
    const p = video.play();
    if (p !== undefined) {
        void p.catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
            if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
                return;
            }
        });
    }
}

export function ensureForyouIosVideoLoad(el: HTMLVideoElement | null | undefined): void {
    if (!el || !isForyouIosPlayback()) {
        return;
    }
    if (
        el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
        el.networkState === HTMLMediaElement.NETWORK_LOADING
    ) {
        return;
    }
    try {
        el.load();
    } catch {
        // ignore
    }
}

/** iOS 滑切：在用户手势链内对目标 video 有声起播 */
export function kickForyouIosGestureAutoplay(video: HTMLVideoElement | null | undefined): void {
    if (!video || !isForyouIosPlayback()) {
        return;
    }
    video.muted = false;
    ensureForyouIosVideoLoad(video);
    safeForyouIosPlay(video);
}

function scheduleForyouIosWhenReady(el: HTMLVideoElement, run: () => void, timeoutMs = 2000): void {
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        run();
        return;
    }
    let done = false;
    const finish = () => {
        if (done) {
            return;
        }
        done = true;
        cleanup();
        run();
    };
    const cleanup = () => {
        el.removeEventListener('loadedmetadata', finish);
        el.removeEventListener('loadeddata', finish);
        el.removeEventListener('canplay', finish);
        window.clearTimeout(timer);
    };
    el.addEventListener('loadedmetadata', finish, { once: true });
    el.addEventListener('loadeddata', finish, { once: true });
    el.addEventListener('canplay', finish, { once: true });
    const timer = window.setTimeout(finish, timeoutMs);
}

function shouldIosBlockMuteFallback(isFeedColdAutoplay: boolean, wasSwipe: boolean): boolean {
    if (isFeedColdAutoplay) {
        return false;
    }
    return wasSwipe;
}

function isIosPlayAbortError(err: unknown): boolean {
    if (err instanceof DOMException && err.name === 'AbortError') {
        return true;
    }
    return Boolean(
        err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError',
    );
}

function playWithOptionalMuteFallback(
    v: HTMLVideoElement,
    preferSoundAutoplay: boolean,
    blockIosMuteFallback: boolean,
    onSuccess: () => void,
    onPlayFail: () => void,
    onMutedUi: () => void,
): void {
    v.play()
        .then(onSuccess)
        .catch((err: unknown) => {
            if (isIosPlayAbortError(err)) {
                return;
            }
            if (preferSoundAutoplay && !v.muted) {
                if (blockIosMuteFallback) {
                    v.muted = false;
                    ensureForyouIosVideoLoad(v);
                    safeForyouIosPlay(v);
                    return;
                }
                v.muted = true;
                onMutedUi();
                v.play()
                    .then(onSuccess)
                    .catch((mutedErr: unknown) => {
                        if (!isIosPlayAbortError(mutedErr)) {
                            onPlayFail();
                        }
                    });
                return;
            }
            onPlayFail();
        });
}

/** iOS H5 For You 专用起播（Android 请走 foryouPlaybackKick.kickForyouAutoplay） */
export function kickForyouIosAutoplay(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    if (!isForyouIosPlayback()) {
        return;
    }

    const isFeedColdAutoplay = Boolean(rt.isFeedColdAutoplay);
    const preferSoundAutoplay = preferForyouSoundAutoplay(isFeedColdAutoplay);

    const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
    rt.legacyEpisodeAutoplayRef.current = false;
    const wasSwipe = useLegacyEpisodePlayback;
    const blockIosMuteFallback = shouldIosBlockMuteFallback(isFeedColdAutoplay, wasSwipe);

    if (location.search.indexOf('auto_play=0') !== -1) {
        el.muted = false;
        return;
    }

    const syncMuted = (muted: boolean) => {
        el.muted = muted;
        rt.onVideoMutedUiSync?.(muted);
        setForyouPlayerMuted(muted);
    };

    const scheduleWhenBuffered = (run: () => void) => {
        if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            run();
            return;
        }
        run();
        scheduleForyouIosWhenReady(el, run);
    };

    if (useLegacyEpisodePlayback) {
        if (isFeedColdAutoplay) {
            syncMuted(true);
        } else if (preferSoundAutoplay || wasSwipe) {
            syncMuted(false);
        } else {
            syncMuted(getForyouPlayerMuted());
        }
        const runLegacyPlay = () => {
            const v = rt.videoRef.current;
            if (!v) {
                return;
            }
            const onPlayFail = () => {
                rt.showController(false);
                rt.setWaiting(false);
                rt.setCanPlay(true);
                if (blockIosMuteFallback && v) {
                    v.muted = false;
                    ensureForyouIosVideoLoad(v);
                    safeForyouIosPlay(v);
                }
            };
            playWithOptionalMuteFallback(
                v,
                preferSoundAutoplay,
                blockIosMuteFallback,
                () => rt.setPlaying(true),
                onPlayFail,
                () => rt.onVideoMutedUiSync?.(true),
            );
        };
        scheduleWhenBuffered(runLegacyPlay);
        return;
    }

    if (isFeedColdAutoplay) {
        syncMuted(true);
        setForyouPlayerMuted(true);
    } else if (preferSoundAutoplay) {
        syncMuted(false);
    } else {
        syncMuted(true);
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
            rt.setShowTapToUnmute(false);
            if (blockIosMuteFallback) {
                v.muted = false;
                ensureForyouIosVideoLoad(v);
                safeForyouIosPlay(v);
            }
        };
        playWithOptionalMuteFallback(
            v,
            preferSoundAutoplay,
            blockIosMuteFallback,
            () => rt.setPlaying(true),
            onPlayFail,
            () => rt.onVideoMutedUiSync?.(true),
        );
    };

    scheduleWhenBuffered(runPlay);

    window.clearTimeout(rt.controllerTimerRef.current);
    rt.controllerTimerRef.current = window.setTimeout(() => {
        rt.hideController();
    }, 10000);
}

/** loadData 内：fetch 完成前 iOS 补 load / 手势窗口 early play */
export function primeForyouIosLoadDataVideo(
    video: HTMLVideoElement | null,
    opts: {
        isFeedColdAutoplay: boolean;
        fromHomeVideoPlayback: boolean;
        onMutedUi: (muted: boolean) => void;
    },
): void {
    if (!video || !isForyouIosPlayback()) {
        return;
    }
    ensureForyouIosVideoLoad(video);
    if (opts.isFeedColdAutoplay) {
        video.muted = true;
        opts.onMutedUi(true);
        setForyouPlayerMuted(true);
        safeForyouIosPlay(video);
        return;
    }
    video.muted = false;
    opts.onMutedUi(false);
    if (opts.fromHomeVideoPlayback && consumeForyouIosTabGesture()) {
        safeForyouIosPlay(video);
    } else if (!opts.fromHomeVideoPlayback) {
        safeForyouIosPlay(video);
    }
}

export function bindForyouIosPlayRetry(
    el: HTMLVideoElement,
    shouldRetry: () => boolean,
): () => void {
    if (!isForyouIosPlayback()) {
        return () => {};
    }
    const retry = () => {
        if (!shouldRetry() || !el.querySelector('source')) {
            return;
        }
        safeForyouIosPlay(el);
    };
    el.addEventListener('canplay', retry);
    el.addEventListener('loadeddata', retry);
    return () => {
        el.removeEventListener('canplay', retry);
        el.removeEventListener('loadeddata', retry);
    };
}
