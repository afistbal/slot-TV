import { releaseVideoFullscreenOrientation } from '@/lib/videoFullscreenOrientation';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type Player from 'xgplayer';

import { toggleVideoFullscreen } from '@/lib/toggleFullscreen';

import { markUserGesture } from '../feed/userGesturePlay';
import { isUserHoldPause, scheduleActivePlay } from '../player/createXgPlayer';

import {
    getFullscreenElement,
    isIosNativeVideoFullscreen,
    IMMERSIVE_FULLSCREEN_CLASS,
    IMMERSIVE_FULLSCREEN_EVENT,
    LANDSCAPE_FULLSCREEN_CLASS,
} from './feedPlayerFullscreen';
import { getVideoEl } from './playerControlsApi';

export type UseFeedPlayerFullscreenOptions = {
    fullscreenTargetRef: RefObject<HTMLElement | null>;
    isDesktop: boolean;
    activeEpisodeKey: string | number;
    getActivePlayer: () => Player | null;
    onFullscreenUiChange?: (active: boolean) => void;
    /** iOS 原生 video 全屏退出（webkitendfullscreen）；返回 true 表示已处理 ended 切条，勿 resumeIfPaused */
    onIosNativeFullscreenEnd?: () => boolean | void;
    enabled?: boolean;
};

function dispatchImmersiveChange(active: boolean) {
    window.dispatchEvent(
        new CustomEvent(IMMERSIVE_FULLSCREEN_EVENT, { detail: { active } }),
    );
}

function setFullscreenDom(
    el: HTMLElement | null,
    immersiveActive: boolean,
    landscapeActive = false,
) {
    if (!el) return;
    el.classList.toggle(IMMERSIVE_FULLSCREEN_CLASS, immersiveActive);
    el.classList.toggle(LANDSCAPE_FULLSCREEN_CLASS, landscapeActive);
    dispatchImmersiveChange(immersiveActive);
}

export function useFeedPlayerFullscreen({
    fullscreenTargetRef,
    isDesktop,
    activeEpisodeKey,
    getActivePlayer,
    onFullscreenUiChange,
    onIosNativeFullscreenEnd,
    enabled = true,
}: UseFeedPlayerFullscreenOptions) {
    const [keepFullscreen, setKeepFullscreen] = useState(false);
    const [landscapeFullscreen, setLandscapeFullscreen] = useState(false);
    const [mobileCssFullscreen, setMobileCssFullscreen] = useState(false);
    const mobileCssFullscreenRef = useRef(false);
    useEffect(() => () => releaseVideoFullscreenOrientation(), []);
    const [pcFullscreen, setPcFullscreen] = useState(false);
    const suppressUntilRef = useRef(0);
    const switchingRef = useRef(false);
    const restoreInFlightRef = useRef(false);
    const restoreEpisodeRef = useRef<string | number | null>(null);
    const getActivePlayerRef = useRef(getActivePlayer);
    getActivePlayerRef.current = getActivePlayer;
    const onIosNativeFullscreenEndRef = useRef(onIosNativeFullscreenEnd);
    onIosNativeFullscreenEndRef.current = onIosNativeFullscreenEnd;

    const isImmersive = !isDesktop && keepFullscreen && !pcFullscreen;
    const isFullscreenUi = isDesktop ? pcFullscreen : keepFullscreen || pcFullscreen;

    useEffect(() => {
        onFullscreenUiChange?.(isFullscreenUi);
    }, [isFullscreenUi, onFullscreenUiChange]);

    useEffect(() => {
        if (!enabled || isDesktop) return;
        const fullscreenTarget = fullscreenTargetRef.current;
        setFullscreenDom(
            fullscreenTarget,
            isImmersive,
            isFullscreenUi && landscapeFullscreen,
        );
        return () => setFullscreenDom(fullscreenTarget, false, false);
    }, [
        enabled,
        fullscreenTargetRef,
        isDesktop,
        isFullscreenUi,
        isImmersive,
        landscapeFullscreen,
    ]);

    const shouldIgnoreFullscreenExit = useCallback(() => {
        return switchingRef.current || Date.now() <= suppressUntilRef.current;
    }, []);

    const markFullscreenTransition = useCallback(() => {
        if (!keepFullscreen && !pcFullscreen) return;
        switchingRef.current = true;
        suppressUntilRef.current = Date.now() + 1800;
    }, [keepFullscreen, pcFullscreen]);

    const onEpisodeFullscreenReady = useCallback(() => {
        switchingRef.current = false;
    }, []);

    const resumeIfPaused = useCallback(() => {
        if (isUserHoldPause()) return;
        const player = getActivePlayerRef.current();
        if (!player) return;
        markUserGesture();
        scheduleActivePlay(player);
    }, []);

    const forceExitFullscreen = useCallback(async () => {
        // Restore the page immediately, before any asynchronous native API call.
        mobileCssFullscreenRef.current = false;
        setKeepFullscreen(false);
        setPcFullscreen(false);
        setLandscapeFullscreen(false);
        setMobileCssFullscreen(false);
        switchingRef.current = false;
        suppressUntilRef.current = 0;
        restoreEpisodeRef.current = null;
        if (!isDesktop) setFullscreenDom(fullscreenTargetRef.current, false, false);
        releaseVideoFullscreenOrientation();
        const video = getVideoEl(getActivePlayerRef.current()) as
            | (HTMLVideoElement & { webkitExitFullscreen?: () => void })
            | null;
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined);
        }
        if (video?.webkitExitFullscreen && isIosNativeVideoFullscreen(video)) {
            try {
                video.webkitExitFullscreen();
            } catch {
                /* ignore */
            }
        }
        if (doc.webkitExitFullscreen) {
            await Promise.resolve(doc.webkitExitFullscreen()).catch(() => undefined);
        }

    }, [fullscreenTargetRef, isDesktop]);

    const toggleFullscreen = useCallback(async () => {
        const player = getActivePlayerRef.current();
        const video = getVideoEl(player);
        if (!video) return false;

        if (isFullscreenUi) {
            await forceExitFullscreen();
            resumeIfPaused();
            return false;
        }

        const isLandscapeVideo =
            video.videoWidth > 0 && video.videoWidth > video.videoHeight;
        setLandscapeFullscreen(isLandscapeVideo);

        // hgdju uses a fixed page layer plus a 90-degree CSS rotation for mobile
        // landscape videos. This works consistently on iPhone, where the native
        // video fullscreen API cannot be forced into landscape by the page.
        if (!isDesktop) {
            markUserGesture();
            mobileCssFullscreenRef.current = true;
            setMobileCssFullscreen(true);
            setPcFullscreen(false);
            setKeepFullscreen(true);
            setFullscreenDom(fullscreenTargetRef.current, true, isLandscapeVideo);
            return true;
        }

        await toggleVideoFullscreen({ current: video }, fullscreenTargetRef, {
            preferContainer: true,
            disableNativeVideoFullscreen: isDesktop,
        });
        setMobileCssFullscreen(false);
        const nowFullscreen = Boolean(getFullscreenElement());
        if (nowFullscreen || !isDesktop) {
            setKeepFullscreen(true);
        }
        setPcFullscreen(nowFullscreen);
        return nowFullscreen || !isDesktop;
    }, [forceExitFullscreen, fullscreenTargetRef, isDesktop, isFullscreenUi, resumeIfPaused]);

    useEffect(() => {
        if (!enabled) return;

        const onFullscreenChange = () => {
            const inFullscreen = Boolean(getFullscreenElement());
            setPcFullscreen(inFullscreen);
            // Mobile landscape uses hgdju's CSS fullscreen route. There is
            // intentionally no document.fullscreenElement in this mode.
            if (!inFullscreen && mobileCssFullscreenRef.current) return;
            if (isDesktop && !inFullscreen) {
                setKeepFullscreen(false);
                setLandscapeFullscreen(false);
                setMobileCssFullscreen(false);
                switchingRef.current = false;
                suppressUntilRef.current = 0;
                return;
            }
            if (!inFullscreen && shouldIgnoreFullscreenExit()) {
                return;
            }
            setKeepFullscreen(inFullscreen);
            if (!inFullscreen) {
                setLandscapeFullscreen(false);
                setMobileCssFullscreen(false);
                setFullscreenDom(fullscreenTargetRef.current, false, false);
            }
        };

        const attachVideoGuards = (video: HTMLVideoElement | null) => {
            if (!video || isDesktop) return () => undefined;

            const onWebkitBeginFullscreen = () => {
                if (mobileCssFullscreenRef.current) return;
                setPcFullscreen(true);
                setKeepFullscreen(true);
            };

            const onWebkitEndFullscreen = () => {
                // Some mobile browsers emit native-video fullscreen events during
                // rotation even when our page fullscreen is still active.
                if (mobileCssFullscreenRef.current) return;
                setPcFullscreen(false);
                setKeepFullscreen(false);
                setLandscapeFullscreen(false);
                mobileCssFullscreenRef.current = false;
                setMobileCssFullscreen(false);
                setFullscreenDom(fullscreenTargetRef.current, false, false);
                const handledEndedAdvance = onIosNativeFullscreenEndRef.current?.() === true;
                if (!handledEndedAdvance && !shouldIgnoreFullscreenExit()) {
                    resumeIfPaused();
                }
            };

            video.addEventListener(
                'webkitbeginfullscreen',
                onWebkitBeginFullscreen as EventListener,
            );
            video.addEventListener(
                'webkitendfullscreen',
                onWebkitEndFullscreen as EventListener,
            );
            return () => {
                video.removeEventListener(
                    'webkitbeginfullscreen',
                    onWebkitBeginFullscreen as EventListener,
                );
                video.removeEventListener(
                    'webkitendfullscreen',
                    onWebkitEndFullscreen as EventListener,
                );
            };
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);

        const detachVideoGuard = attachVideoGuards(getVideoEl(getActivePlayerRef.current()));
        onFullscreenChange();

        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener(
                'webkitfullscreenchange',
                onFullscreenChange as EventListener,
            );
            detachVideoGuard?.();
        };
    }, [
        activeEpisodeKey,
        enabled,
        fullscreenTargetRef,
        isDesktop,
        keepFullscreen,
        mobileCssFullscreen,
        resumeIfPaused,
        shouldIgnoreFullscreenExit,
    ]);

    useEffect(() => {
        if (!enabled || !keepFullscreen || isDesktop) return;

        if (mobileCssFullscreen) {
            const video = getVideoEl(getActivePlayerRef.current());
            const syncDirection = () => {
                if (!mobileCssFullscreenRef.current || !video) return;
                setLandscapeFullscreen(video.videoWidth > 0 && video.videoWidth > video.videoHeight);
            };
            syncDirection();
            video?.addEventListener('loadedmetadata', syncDirection);
            video?.addEventListener('resize', syncDirection);
            restoreEpisodeRef.current = activeEpisodeKey;
            onEpisodeFullscreenReady();
            return () => {
                video?.removeEventListener('loadedmetadata', syncDirection);
                video?.removeEventListener('resize', syncDirection);
            };
        }

        if (restoreEpisodeRef.current === activeEpisodeKey || restoreInFlightRef.current) {
            return;
        }
        if (getFullscreenElement()) {
            restoreEpisodeRef.current = activeEpisodeKey;
            onEpisodeFullscreenReady();
            return;
        }

        const player = getActivePlayerRef.current();
        const video = getVideoEl(player);
        if (!video) return;

        const tryRestore = () => {
            if (getFullscreenElement()) return;
            restoreInFlightRef.current = true;
            void toggleVideoFullscreen({ current: video }, fullscreenTargetRef, {
                preferContainer: true,
                disableNativeVideoFullscreen: isDesktop,
            })
                .then(() => {
                    const inFullscreen = Boolean(getFullscreenElement());
                    setPcFullscreen(inFullscreen);
                    setKeepFullscreen(inFullscreen || !isDesktop);
                })
                .finally(() => {
                    restoreInFlightRef.current = false;
                    restoreEpisodeRef.current = activeEpisodeKey;
                    onEpisodeFullscreenReady();
                });
        };

        if (video.readyState >= 3) {
            tryRestore();
            return;
        }

        const onReady = () => {
            video.removeEventListener('canplay', onReady);
            tryRestore();
        };
        video.addEventListener('canplay', onReady);
        return () => video.removeEventListener('canplay', onReady);
    }, [
        activeEpisodeKey,
        enabled,
        fullscreenTargetRef,
        isDesktop,
        keepFullscreen,
        mobileCssFullscreen,
        onEpisodeFullscreenReady,
    ]);

    useEffect(() => {
        restoreEpisodeRef.current = null;
    }, [activeEpisodeKey]);

    return {
        isFullscreenUi,
        isImmersive,
        markFullscreenTransition,
        toggleFullscreen,
        forceExitFullscreen,
    };
}
