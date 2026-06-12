import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type Player from 'xgplayer';

import { toggleVideoFullscreen } from '@/lib/toggleFullscreen';

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

/** 阻止 iOS 系统 video 全屏（保留自定义底栏） */
function blockIosNativeVideoFullscreen(video: HTMLVideoElement | null | undefined) {
    if (!video) return;
    const v = video as HTMLVideoElement & { webkitExitFullscreen?: () => void };
    if (v.webkitDisplayingFullscreen || v.webkitPresentationMode === 'fullscreen') {
        try {
            v.webkitExitFullscreen?.();
        } catch {
            /* ignore */
        }
    }
}

export function useFeedPlayerFullscreen({
    fullscreenTargetRef,
    isDesktop,
    activeEpisodeKey,
    getActivePlayer,
    onFullscreenUiChange,
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

    /** H5：页面内沉浸全屏；PC：document 全屏 + 沉浸意图 */
    const isImmersive = !isDesktop && keepFullscreen;
    const isFullscreenUi = isDesktop ? keepFullscreen || pcFullscreen : keepFullscreen;

    useEffect(() => {
        onFullscreenUiChange?.(isFullscreenUi);
    }, [isFullscreenUi, onFullscreenUiChange]);

    useEffect(() => {
        if (!enabled || isDesktop) return;
        setImmersiveDom(fullscreenTargetRef.current, keepFullscreen);
        return () => setImmersiveDom(fullscreenTargetRef.current, false);
    }, [enabled, fullscreenTargetRef, isDesktop, keepFullscreen]);

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

    const forceExitFullscreen = useCallback(async () => {
        const video = getVideoEl(getActivePlayerRef.current()) as
            | (HTMLVideoElement & { webkitExitFullscreen?: () => void })
            | null;

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined);
        }
        blockIosNativeVideoFullscreen(video);
        if (video?.webkitExitFullscreen) {
            try {
                video.webkitExitFullscreen();
            } catch {
                /* ignore */
            }
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
            return false;
        }

        /** iOS / H5：仅沉浸 UI，不走 webkitEnterFullscreen / 浏览器全屏 */
        if (!isDesktop) {
            blockIosNativeVideoFullscreen(video);
            setKeepFullscreen(true);
            setImmersiveDom(fullscreenTargetRef.current, true);
            return true;
        }

        await toggleVideoFullscreen({ current: video }, fullscreenTargetRef, {
            preferContainer: true,
            disableNativeVideoFullscreen: true,
        });
        const nowFullscreen = Boolean(getFullscreenElement());
        if (nowFullscreen) {
            setKeepFullscreen(true);
        }
        setPcFullscreen(nowFullscreen);
        return nowFullscreen;
    }, [forceExitFullscreen, fullscreenTargetRef, isDesktop, isFullscreenUi]);

    useEffect(() => {
        if (!enabled) return;

        const onFullscreenChange = () => {
            if (!isDesktop) return;
            const inFullscreen = Boolean(getFullscreenElement());
            setPcFullscreen(inFullscreen);
            if (!inFullscreen && shouldIgnoreFullscreenExit()) {
                return;
            }
            setKeepFullscreen(inFullscreen);
        };

        const attachVideoGuards = (video: HTMLVideoElement | null) => {
            if (!video || isDesktop) return () => undefined;

            const onWebkitBeginFullscreen = () => {
                blockIosNativeVideoFullscreen(video);
            };

            video.addEventListener(
                'webkitbeginfullscreen',
                onWebkitBeginFullscreen as EventListener,
            );
            return () => {
                video.removeEventListener(
                    'webkitbeginfullscreen',
                    onWebkitBeginFullscreen as EventListener,
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
    }, [enabled, isDesktop, shouldIgnoreFullscreenExit, activeEpisodeKey]);

    useEffect(() => {
        if (!enabled || !keepFullscreen) return;

        if (!isDesktop) {
            restoreEpisodeRef.current = activeEpisodeKey;
            onEpisodeFullscreenReady();
            blockIosNativeVideoFullscreen(getVideoEl(getActivePlayerRef.current()));
            return;
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
                disableNativeVideoFullscreen: true,
            })
                .then(() => {
                    const inFullscreen = Boolean(getFullscreenElement());
                    setPcFullscreen(inFullscreen);
                    setKeepFullscreen(inFullscreen);
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
