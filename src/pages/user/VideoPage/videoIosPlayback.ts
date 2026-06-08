import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { hasVideoSessionUserUnmuted } from './videoSessionMute';
import type { LoadEpisodeRuntime } from './videoPlayerLoadEpisode';

/** 仅 `/video` iOS H5 启用；Android / PC 不得调用本模块起播 */
export function isVideoIosPlayback(): boolean {
    return isIosLikeDevice();
}

function marketingSoundQueryEnabled(): boolean {
    return (
        typeof location !== 'undefined' &&
        location.search.length > 1 &&
        location.search.indexOf('auto_play=0') === -1
    );
}

/** iOS H5 `/video`：是否优先有声自动播 */
export function preferVideoIosSoundAutoplay(
    fromHomeVideoPlayback: boolean,
    legacyEpisodeAutoplay: boolean,
): boolean {
    return (
        fromHomeVideoPlayback ||
        legacyEpisodeAutoplay ||
        hasVideoSessionUserUnmuted() ||
        marketingSoundQueryEnabled()
    );
}

export function safeVideoIosPlay(video: HTMLVideoElement): void {
    const p = video.play();
    if (p !== undefined) {
        void p.catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
            if (
                err &&
                typeof err === 'object' &&
                'name' in err &&
                (err as { name: string }).name === 'AbortError'
            ) {
                return;
            }
        });
    }
}

function videoIosVideoHasSourceSrc(el: HTMLVideoElement): boolean {
    const sources = el.querySelectorAll('source');
    if (sources.length === 0) {
        return Boolean(el.getAttribute('src') || el.currentSrc);
    }
    return Array.from(sources).some((s) => Boolean(s.getAttribute('src')));
}

export function ensureVideoIosVideoLoad(el: HTMLVideoElement | null | undefined): void {
    if (!el || !isVideoIosPlayback()) {
        return;
    }
    if (!videoIosVideoHasSourceSrc(el)) {
        return;
    }
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
    }
    if (
        el.networkState === HTMLMediaElement.NETWORK_LOADING &&
        videoIosVideoHasSourceSrc(el)
    ) {
        return;
    }
    try {
        el.load();
    } catch {
        // ignore
    }
}

/** iOS 竖滑切集：在用户手势链内对目标 video 有声起播 */
export function kickVideoIosGestureAutoplay(video: HTMLVideoElement | null | undefined): void {
    if (!video || !isVideoIosPlayback()) {
        return;
    }
    video.muted = false;
    ensureVideoIosVideoLoad(video);
    safeVideoIosPlay(video);
}

function scheduleVideoIosWhenReady(el: HTMLVideoElement, run: () => void, timeoutMs = 2000): void {
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

function shouldIosBlockMuteFallback(isColdAutoplay: boolean, wasSwipe: boolean): boolean {
    if (isColdAutoplay) {
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
                    ensureVideoIosVideoLoad(v);
                    safeVideoIosPlay(v);
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

/** iOS H5 `/video` 专用起播（Android/PC 请走 videoPlaybackKick.kickVideoAutoplay） */
export function kickVideoIosAutoplay(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    if (!isVideoIosPlayback()) {
        return;
    }

    const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
    rt.legacyEpisodeAutoplayRef.current = false;
    const wasSwipe = useLegacyEpisodePlayback;
    const preferSoundAutoplay = preferVideoIosSoundAutoplay(
        rt.fromHomeVideoPlayback,
        useLegacyEpisodePlayback,
    );
    const isColdAutoplay = !preferSoundAutoplay;
    const blockIosMuteFallback = shouldIosBlockMuteFallback(isColdAutoplay, wasSwipe);

    if (location.search.indexOf('auto_play=0') !== -1) {
        el.muted = false;
        return;
    }

    const syncMuted = (muted: boolean) => {
        el.muted = muted;
        rt.onVideoMutedUiSync?.(muted);
    };

    const scheduleWhenBuffered = (run: () => void) => {
        if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            run();
            return;
        }
        scheduleVideoIosWhenReady(el, run);
    };

    if (useLegacyEpisodePlayback) {
        if (isColdAutoplay) {
            syncMuted(true);
        } else if (preferSoundAutoplay || wasSwipe) {
            syncMuted(false);
        } else {
            syncMuted(!hasVideoSessionUserUnmuted());
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
                    ensureVideoIosVideoLoad(v);
                    safeVideoIosPlay(v);
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

    if (isColdAutoplay) {
        syncMuted(true);
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
            if (blockIosMuteFallback) {
                v.muted = false;
                ensureVideoIosVideoLoad(v);
                safeVideoIosPlay(v);
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

/** loadData 内：fetch 完成前 iOS 补 load / early play */
export function primeVideoIosLoadDataVideo(
    video: HTMLVideoElement | null,
    opts: {
        isColdAutoplay: boolean;
        fromHomeVideoPlayback: boolean;
        onMutedUi: (muted: boolean) => void;
    },
): void {
    if (!video || !isVideoIosPlayback()) {
        return;
    }
    ensureVideoIosVideoLoad(video);
    if (opts.isColdAutoplay) {
        video.muted = true;
        opts.onMutedUi(true);
        safeVideoIosPlay(video);
        return;
    }
    video.muted = false;
    opts.onMutedUi(false);
    safeVideoIosPlay(video);
}

export function bindVideoIosPlayRetry(
    el: HTMLVideoElement,
    shouldRetry: () => boolean,
): () => void {
    if (!isVideoIosPlayback()) {
        return () => {};
    }
    const retry = () => {
        if (!shouldRetry() || !videoIosVideoHasSourceSrc(el)) {
            return;
        }
        ensureVideoIosVideoLoad(el);
        safeVideoIosPlay(el);
    };
    el.addEventListener('canplay', retry);
    el.addEventListener('loadeddata', retry);
    return () => {
        el.removeEventListener('canplay', retry);
        el.removeEventListener('loadeddata', retry);
    };
}
