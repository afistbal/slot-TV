import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { preferVideoSoundAutoplay } from './videoAutoplayPolicy';
import type { LoadEpisodeRuntime } from './videoPlayerLoadEpisode';

/** 仅 `/video` iOS H5 启用；Android / PC 不得调用本模块起播 */
export function isVideoIosPlayback(): boolean {
    return isIosLikeDevice();
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
    /** 已有 metadata 时勿 load()，否则滑切邻格会黑屏再解码首帧（对标 foryouIosPlayback 行为） */
    if (
        el.readyState >= HTMLMediaElement.HAVE_METADATA ||
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
            if (!preferSoundAutoplay && v.muted) {
                ensureVideoIosVideoLoad(v);
                scheduleVideoIosWhenReady(v, () => {
                    v.play()
                        .then(onSuccess)
                        .catch((mutedErr: unknown) => {
                            if (!isIosPlayAbortError(mutedErr)) {
                                onPlayFail();
                            }
                        });
                });
                return;
            }
            onPlayFail();
        });
}

/** iOS H5 `/video` 专用起播（对标 `kickForyouIosAutoplay`） */
export function kickVideoIosAutoplay(rt: LoadEpisodeRuntime, el: HTMLVideoElement): void {
    if (!isVideoIosPlayback()) {
        return;
    }

    const isVideoColdAutoplay = Boolean(rt.isVideoColdAutoplay);
    const preferSoundAutoplay = preferVideoSoundAutoplay(isVideoColdAutoplay);
    const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
    rt.legacyEpisodeAutoplayRef.current = false;
    const wasSwipe = useLegacyEpisodePlayback;
    const blockIosMuteFallback = shouldIosBlockMuteFallback(isVideoColdAutoplay, wasSwipe);

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
        if (isVideoColdAutoplay) {
            syncMuted(true);
        } else if (preferSoundAutoplay || wasSwipe) {
            syncMuted(false);
        } else {
            syncMuted(true);
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

    if (isVideoColdAutoplay) {
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

/** loadData 内：fetch 完成前 iOS 补 load / early play（对标 `primeForyouIosLoadDataVideo`） */
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
        if (!el.paused && !el.ended) {
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
