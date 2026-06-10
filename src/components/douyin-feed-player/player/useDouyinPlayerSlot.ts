import { useCallback, useEffect, useRef } from 'react';

import type Player from 'xgplayer';

import { resolveFeedSlideEl } from '../controls/resolveFeedSlideEl';
import type { PlaybackMode } from '../types';

import { attachMseErrorDegrade } from '../playback/attachMseErrorDegrade';
import { attachPlaybackHelpers } from '../playback/attachPlaybackHelpers';

import { attachBufferWaterLevel } from '../playback/bufferWaterLevel';

import { suspendPlayerLoading } from '../playback/playerLoadingControl';
import { trySwitchPlayerUrl } from '../playback/playNextSource';

import { attachNativeVideoAspectFit, attachVideoAspectFit } from '../playback/videoAspectFit';

import { resolvePlaybackMode } from '../playback/pickPlaybackMode';

import {
    createXgPlayer,
    pausePlayer,
    scheduleActivePlay,
    type XgPlayerHandle,
} from './createXgPlayer';

export type UseDouyinPlayerSlotOptions = {
    mountEl: HTMLElement | null;
    url: string;
    isActive: boolean;
    shouldInit: boolean;
    hasPreload?: boolean;
    slotIndex?: number;
    onPlayerChange?: (player: Player | null) => void;
    onPlaybackModeChange?: (index: number, mode: PlaybackMode) => void;
    onStall?: (index: number, reason: string) => void;
    onEnded?: () => void;
};

export function useDouyinPlayerSlot(options: UseDouyinPlayerSlotOptions) {
    const handleRef = useRef<XgPlayerHandle | null>(null);
    const helpersRef = useRef<(() => void) | null>(null);
    const aspectFitRef = useRef<(() => void) | null>(null);
    const endedDisposeRef = useRef<(() => void) | null>(null);
    const nativeModeRef = useRef(false);
    const prevUrlRef = useRef<string | null>(null);
    const urlRef = useRef(options.url);
    const isActiveRef = useRef(options.isActive);
    const hasPreloadRef = useRef(options.hasPreload ?? false);
    const shouldInitRef = useRef(options.shouldInit);
    const mountElRef = useRef(options.mountEl);
    const slotIndexRef = useRef(options.slotIndex ?? 0);
    const switchGenerationRef = useRef(0);
    const mseErrorDisposeRef = useRef<(() => void) | null>(null);

    const onPlayerChangeRef = useRef(options.onPlayerChange);
    const onModeChangeRef = useRef(options.onPlaybackModeChange);
    const onStallRef = useRef(options.onStall);
    const onEndedRef = useRef(options.onEnded);

    urlRef.current = options.url;
    isActiveRef.current = options.isActive;
    hasPreloadRef.current = options.hasPreload ?? false;
    shouldInitRef.current = options.shouldInit;
    mountElRef.current = options.mountEl;
    slotIndexRef.current = options.slotIndex ?? 0;
    onPlayerChangeRef.current = options.onPlayerChange;
    onModeChangeRef.current = options.onPlaybackModeChange;
    onStallRef.current = options.onStall;
    onEndedRef.current = options.onEnded;

    const notifyPlayerChange = useCallback((player: Player | null) => {
        const fn = onPlayerChangeRef.current;
        if (typeof fn === 'function') fn(player);
    }, []);

    const emitModeChange = useCallback((mode: PlaybackMode) => {
        onModeChangeRef.current?.(slotIndexRef.current, mode);
    }, []);

    const emitStall = useCallback((reason: string) => {
        onStallRef.current?.(slotIndexRef.current, reason);
    }, []);

    const getSlotEl = useCallback(() => {
        return (
            (mountElRef.current?.closest('.douyin-player-slot__stage') as HTMLElement | null) ??
            (mountElRef.current?.closest('.douyin-player-slot') as HTMLElement | null)
        );
    }, []);

    const getFullscreenTarget = useCallback(() => {
        return resolveFeedSlideEl(mountElRef.current);
    }, []);

    const bindEndedListener = useCallback((player: Player) => {
        endedDisposeRef.current?.();

        const handler = () => onEndedRef.current?.();
        player.on('ended', handler);

        endedDisposeRef.current = () => {
            player.off('ended', handler);
        };
    }, []);

    const teardownHelpers = useCallback(() => {
        mseErrorDisposeRef.current?.();
        mseErrorDisposeRef.current = null;
        aspectFitRef.current?.();
        aspectFitRef.current = null;
        helpersRef.current?.();
        helpersRef.current = null;
    }, []);

    const teardownPlayer = useCallback(() => {
        endedDisposeRef.current?.();
        endedDisposeRef.current = null;
        teardownHelpers();
        const player = handleRef.current?.player;
        if (player) {
            suspendPlayerLoading(player);
        }
        handleRef.current?.destroy();
        handleRef.current = null;
        notifyPlayerChange(null);
    }, [teardownHelpers, notifyPlayerChange]);

    const applyActivePlayback = useCallback(() => {
        const player = handleRef.current?.player;
        if (!player) return;

        if (isActiveRef.current) {
            scheduleActivePlay(player);
        } else {
            pausePlayer(player);
        }
    }, []);

    const degradeToNative = useCallback(
        (currentTime: number) => {
            if (nativeModeRef.current) return;

            const mountEl = mountElRef.current;
            if (!mountEl) return;

            nativeModeRef.current = true;
            teardownHelpers();
            handleRef.current?.destroy();
            handleRef.current = null;
            mountEl.innerHTML = '';

            const handle = createXgPlayer({
                el: mountEl,
                url: urlRef.current,
                autoplay: isActiveRef.current,
                forceNative: true,
                hasPreload: true,
                fullscreenTarget: getFullscreenTarget(),
            });
            handleRef.current = handle;
            emitModeChange('native');
            notifyPlayerChange(handle.player);
            bindEndedListener(handle.player);

            const slotEl = getSlotEl();
            const video = handle.player.video as HTMLVideoElement | undefined;
            if (video) {
                aspectFitRef.current = attachNativeVideoAspectFit(video, slotEl);
                helpersRef.current = attachBufferWaterLevel(video);
                if (currentTime > 0) {
                    const onMeta = () => {
                        video.currentTime = currentTime;
                        if (isActiveRef.current) {
                            video.play().catch(() => undefined);
                        }
                        video.removeEventListener('loadedmetadata', onMeta);
                    };
                    video.addEventListener('loadedmetadata', onMeta);
                }
            }

            prevUrlRef.current = urlRef.current;
        },
        [teardownHelpers, emitModeChange, getSlotEl, notifyPlayerChange, bindEndedListener, getFullscreenTarget],
    );

    const initPlayer = useCallback(
        (url: string, hasPreload: boolean): XgPlayerHandle | null => {
            const mountEl = mountElRef.current;
            if (!mountEl || !url) return null;

            mountEl.innerHTML = '';

            const handle = createXgPlayer({
                el: mountEl,
                url,
                autoplay: isActiveRef.current,
                hasPreload,
                forceNative: nativeModeRef.current,
                fullscreenTarget: getFullscreenTarget(),
            });
            handleRef.current = handle;
            emitModeChange(handle.mode);
            notifyPlayerChange(handle.player);
            bindEndedListener(handle.player);

            const slotEl = getSlotEl();
            aspectFitRef.current = attachVideoAspectFit(handle.player, slotEl);

            const video = handle.player.video as HTMLVideoElement | undefined;
            if (video) {
                helpersRef.current = attachPlaybackHelpers({
                    video,
                    mode: handle.mode,
                    onDegradeToNative: degradeToNative,
                    onStall: emitStall,
                });
                if (handle.mode === 'mse') {
                    mseErrorDisposeRef.current = attachMseErrorDegrade(
                        handle.player,
                        degradeToNative,
                    );
                }
            }

            return handle;
        },
        [degradeToNative, emitModeChange, emitStall, getSlotEl, notifyPlayerChange, bindEndedListener, getFullscreenTarget],
    );

    // MD-ref §8.5.2 playNext 换源：仅 url 变化时 switchURL，pause/play 由 Feed 层事件驱动
    const syncPlaybackFromOptions = useCallback(() => {
        const url = urlRef.current;
        const shouldInit = shouldInitRef.current;
        const hasPreload = hasPreloadRef.current;

        if (!shouldInit || !url) return;

        if (!handleRef.current) {
            return;
        }

        if (prevUrlRef.current === url) {
            return;
        }

        const generation = ++switchGenerationRef.current;

        const handle = handleRef.current;
        const targetMode = resolvePlaybackMode({
            hasPreload,
            forceNative: nativeModeRef.current,
            url,
        });

        if (handle.mode !== targetMode && !nativeModeRef.current) {
            teardownPlayer();
            initPlayer(url, hasPreload);
            prevUrlRef.current = url;
            if (handleRef.current) {
                nativeModeRef.current = handleRef.current.mode === 'native';
            }
            applyActivePlayback();
            return;
        }

        void trySwitchPlayerUrl(handle.player, url, {
            autoplay: isActiveRef.current,
            mode: handle.mode,
        }).then((ok) => {
            if (generation !== switchGenerationRef.current) return;

            if (ok) {
                prevUrlRef.current = url;
                applyActivePlayback();
                return;
            }

            teardownPlayer();
            initPlayer(url, hasPreload);
            prevUrlRef.current = url;
            if (handleRef.current) {
                nativeModeRef.current =
                    nativeModeRef.current || handleRef.current.mode === 'native';
            }
            applyActivePlayback();
        });
    }, [initPlayer, teardownPlayer, applyActivePlayback]);

    const initPlayerRef = useRef(initPlayer);
    initPlayerRef.current = initPlayer;
    const teardownPlayerRef = useRef(teardownPlayer);
    teardownPlayerRef.current = teardownPlayer;

    // MD-ref: mount-only — mountEl/shouldInit 变化需创建或销毁 xgplayer 实例
    useEffect(() => {
        const { mountEl, shouldInit, url } = options;

        if (!mountEl || !shouldInit || !url) {
            teardownPlayerRef.current();
            nativeModeRef.current = false;
            prevUrlRef.current = null;
            return;
        }

        if (!handleRef.current) {
            const created = initPlayerRef.current(url, hasPreloadRef.current);
            prevUrlRef.current = url;
            if (created) {
                nativeModeRef.current = nativeModeRef.current || created.mode === 'native';
            }
        }

        return () => {
            teardownPlayerRef.current();
            nativeModeRef.current = false;
            prevUrlRef.current = null;
        };
    }, [options.mountEl, options.shouldInit]);

    useEffect(() => {
        if (!options.shouldInit || !options.url) return;
        syncPlaybackFromOptions();
    }, [options.url, syncPlaybackFromOptions]);

    return handleRef;
}

export function getPlayerFromSlot(
    ref: ReturnType<typeof useDouyinPlayerSlot>,
): XgPlayerHandle['player'] | null {
    return ref.current?.player ?? null;
}
