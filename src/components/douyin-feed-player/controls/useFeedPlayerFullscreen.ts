import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type Player from 'xgplayer';

import { toggleVideoFullscreen } from '@/lib/toggleFullscreen';

import { markUserGesture } from '../feed/userGesturePlay';
import { isUserHoldPause, scheduleActivePlay } from '../player/createXgPlayer';

import {
    getFullscreenElement,
    IMMERSIVE_FULLSCREEN_CLASS,
    IMMERSIVE_FULLSCREEN_EVENT,
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

function setImmersiveDom(el: HTMLElement | null, active: boolean) {
    if (!el) return;
    if (active) {
        el.classList.add(IMMERSIVE_FULLSCREEN_CLASS);
    } else {
        el.classList.remove(IMMERSIVE_FULLSCREEN_CLASS);
    }
    dispatchImmersiveChange(active);
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
        setImmersiveDom(fullscreenTargetRef.current, isImmersive);
        return () => setImmersiveDom(fullscreenTargetRef.current, false);
    }, [enabled, fullscreenTargetRef, isDesktop, isImmersive]);

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
        const video = getVideoEl(getActivePlayerRef.current()) as
            | (HTMLVideoElement & { webkitExitFullscreen?: () => void })
            | null;
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined);
        }
        if (video?.webkitExitFullscreen) {
            try {
                video.webkitExitFullscreen();
            } catch {
                /* ignore */
            }
        }
        if (doc.webkitExitFullscreen) {
            await Promise.resolve(doc.webkitExitFullscreen()).catch(() => undefined);
        }

        setKeepFullscreen(false);
        setPcFullscreen(false);
        if (!isDesktop) {
            setImmersiveDom(fullscreenTargetRef.current, false);
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

        await toggleVideoFullscreen({ current: video }, fullscreenTargetRef, {
            preferContainer: true,
            disableNativeVideoFullscreen: isDesktop,
        });
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
            if (isDesktop && !inFullscreen) {
                setKeepFullscreen(false);
                switchingRef.current = false;
                suppressUntilRef.current = 0;
                return;
            }
            if (!inFullscreen && !isDesktop && keepFullscreen) {
                return;
            }
            if (!inFullscreen && shouldIgnoreFullscreenExit()) {
                return;
            }
            setKeepFullscreen(inFullscreen);
        };

        const attachVideoGuards = (video: HTMLVideoElement | null) => {
            if (!video || isDesktop) return () => undefined;

            const onWebkitBeginFullscreen = () => {
                setPcFullscreen(true);
                setKeepFullscreen(true);
            };

            const onWebkitEndFullscreen = () => {
                setPcFullscreen(false);
                setKeepFullscreen(false);
                setImmersiveDom(fullscreenTargetRef.current, false);
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

        let detachVideoGuard = attachVideoGuards(getVideoEl(getActivePlayerRef.current()));
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
        resumeIfPaused,
        shouldIgnoreFullscreenExit,
    ]);

    useEffect(() => {
        if (!enabled || !keepFullscreen || isDesktop) return;

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
