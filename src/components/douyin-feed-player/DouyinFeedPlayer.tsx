import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
    type TouchEvent as ReactTouchEvent,
} from 'react';
import type Player from 'xgplayer';

import { cn } from '@/lib/utils';

import { DouyinPlayerControls } from './controls/DouyinPlayerControls';
import { isIosNativeVideoFullscreen } from './controls/feedPlayerFullscreen';
import { getVideoEl } from './controls/playerControlsApi';
import { useFeedPlayerFullscreen } from './controls/useFeedPlayerFullscreen';
import { buildPlayerSlots, getFeedItemDataAttrs } from './feed/buildPlayerSlots';
import { bindWheelNavigate } from './feed/wheelNavigate';
import { resolveMediaUrl } from './media/resolveMediaUrl';
import { detectPlatform } from './platform/detectPlatform';
import { PLAYER_WINDOW_RADIUS, RESUME_PLAY_WATER_LEVEL } from './constants';
import { readMutedPreference } from './controls/mutePreference';
import { markChainAutoplay } from './feed/chainAutoplay';
import { feedDbg, setFeedDbgContext } from './feed/feedDebugLog';
import { markNeighborMount, msSinceChainUnmute } from './feed/feedPlayAttribution';
import { feedVideoMp4FromPlayer } from './feed/feedVideoMp4Log';
import {
    isUserGestureActive,
    isUserAudioUnlocked,
    markUserGesture,
    setUserTouching,
    syncAudioUnlockFromPreference,
} from './feed/userGesturePlay';
import {
    bindIosActivePauseRecover,
    bindIosChainPlayRetry,
    playIosChainWithSound,
    recoverIosActiveChainIfPaused,
    tryPlayIosChainInEndedStack,
} from './playback/iosChainPlayback';
import {
    attachActiveNeighborPrime,
    primeDouyinNeighborBuffer,
} from './playback/primeNeighborBuffer';
import { resumePlayerLoading } from './playback/playerLoadingControl';
import {
    isIosChainWantPlay,
    isUserHoldPause,
    pausePlayer,
    scheduleActivePlay,
    setIosChainWantPlay,
    setUserHoldPause,
} from './player/createXgPlayer';
import * as playerRegistry from './player/playerRegistry';
import { DouyinPlayerSlot } from './player/DouyinPlayerSlot';
import type { DouyinFeedPlayerProps, FeedNavigateDirection } from './types';

import './douyin-feed-player.scss';

const FEED_SLIDE_ANIMATION_MS = 400;
const FEED_TOUCH_THRESHOLD_PX = 20;

function isVerticalFeedControlTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
        target.closest(
            [
                '.douyin-player-controls',
                '.video-player-center-play',
                '[data-vertical-swipe-ignore]',
                '.xgplayer-controls',
                '.xgplayer-progress',
                '.xgplayer-progress-bar',
                '.xgplayer-progress-played',
                '.xgplayer-progress-dot',
                '.xgplayer-progress-cache',
                '.xgplayer-progress-btn',
                '.xgplayer-volume',
                '.xgplayer-play',
                '.xgplayer-pause',
                '.xgplayer-fullscreen',
                '.xgplayer-texttrack',
                '.xgplayer-playbackrate',
                'button',
                'a',
            ].join(', '),
        ),
    );
}

/**
 * 抖音式 Feed 播放器（滑动层 + xgplayer 播放层）
 * 逻辑来源：抖音H5滑动与播放逻辑分析.md + 抖音H5-iOS播放适配分析.md
 */
export function DouyinFeedPlayer({
    items,
    mediaBaseUrl,
    className,
    onIndexChange,
    preloadNext = true,
    initialIndex = 0,
    onPlaybackModeChange,
    onStall,
    showControls = true,
    showNextEpisode = false,
    onNextEpisode,
    controlsTopContent,
    fixedPlaybackSpeed = false,
    fullscreenTargetRef,
    isDesktop = false,
    onFullscreenUiChange,
    feedNavigateRef,
}: DouyinFeedPlayerProps) {
    const isVideoH5Feed = Boolean(className?.includes('v-demo-h5-player'));
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const playerByIndexRef = useRef<Map<number, Player>>(new Map());
    const [activePlayer, setActivePlayer] = useState<Player | null>(null);
    const pendingPlayIndexRef = useRef<number | null>(null);
    const [activeIndex, setActiveIndex] = useState(() =>
        Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)),
    );
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;
    const [slideHeight, setSlideHeight] = useState(() =>
        typeof window === 'undefined' ? 0 : window.innerHeight,
    );
    const slideHeightRef = useRef(slideHeight);
    const [offsetY, setOffsetY] = useState(() => slideHeight * activeIndex);
    const offsetYRef = useRef(offsetY);
    const [animating, setAnimating] = useState(false);
    const animationTimerRef = useRef<number | null>(null);
    const touchActiveRef = useRef(false);
    const isFirstTouchRef = useRef(true);
    const touchStartYRef = useRef(0);
    const lastTouchYRef = useRef(0);

    const setFeedOffsetY = useCallback((value: number) => {
        offsetYRef.current = value;
        setOffsetY(value);
    }, []);

    const clearSlideAnimationTimer = useCallback(() => {
        if (animationTimerRef.current == null) return;
        window.clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
    }, []);

    const setSlideAnimating = useCallback(
        (value: boolean) => {
            clearSlideAnimationTimer();
            setAnimating(value);
            if (value) {
                animationTimerRef.current = window.setTimeout(() => {
                    animationTimerRef.current = null;
                    setAnimating(false);
                }, FEED_SLIDE_ANIMATION_MS);
            }
        },
        [clearSlideAnimationTimer],
    );

    useEffect(() => {
        syncAudioUnlockFromPreference();
    }, []);

    useLayoutEffect(() => {
        const root = scrollerRef.current;
        if (!root) return;

        const measure = () => {
            const nextHeight = root.clientHeight || window.innerHeight;
            slideHeightRef.current = nextHeight;
            setSlideHeight(nextHeight);
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        window.addEventListener('resize', measure);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    useEffect(() => {
        const nextOffset = slideHeight * activeIndex;
        setFeedOffsetY(nextOffset);
    }, [activeIndex, setFeedOffsetY, slideHeight]);

    useEffect(() => () => clearSlideAnimationTimer(), [clearSlideAnimationTimer]);

    const onIndexChangeRef = useRef(onIndexChange);
    onIndexChangeRef.current = onIndexChange;
    const onNextEpisodeRef = useRef(onNextEpisode);
    onNextEpisodeRef.current = onNextEpisode;
    const showNextEpisodeRef = useRef(showNextEpisode);
    showNextEpisodeRef.current = showNextEpisode;
    const playbackItemsLengthRef = useRef(items.length);
    const playbackItemsRef = useRef(items);
    const navigateRef = useRef<(direction: FeedNavigateDirection) => void>(() => undefined);
    const preloadGateRef = useRef(false);
    const [preloadGate, setPreloadGate] = useState(false);
    const [suppressNextPreload, setSuppressNextPreload] = useState(false);
    const preloadGateDisposeRef = useRef<(() => void) | null>(null);
    const preloadGateAttachedRef = useRef<Player | null>(null);
    const postRenderTransitionRef = useRef<'append-play' | 'shrink-clamp' | null>(null);
    const shrinkTargetRef = useRef<number | null>(null);
    const endedStackPlayRef = useRef(false);
    const iosPendingEndedFromRef = useRef<number | null>(null);
    const iosWaitNativeExitRef = useRef(false);
    const iosSkipResumeAfterExitRef = useRef(false);
    const advanceAfterEndedRef = useRef<(current: number) => void>(() => undefined);
    const iosChainRetryDisposeRef = useRef<(() => void) | null>(null);
    const iosPauseRecoverDisposeRef = useRef<(() => void) | null>(null);
    const activeNeighborPrimeDisposeRef = useRef<(() => void) | null>(null);
    const suppressNextPreloadTimerRef = useRef<number | null>(null);
    const emptyFullscreenTargetRef = useRef<HTMLElement | null>(null);
    const resolvedFullscreenTargetRef =
        fullscreenTargetRef ?? (emptyFullscreenTargetRef as RefObject<HTMLElement | null>);
    const fullscreenEnabled = Boolean(fullscreenTargetRef);

    const playbackItems = useMemo(() => {
        const base = String(mediaBaseUrl ?? '').trim();
        return items.map((item) => {
            const subtitleRaw = item.subtitle != null ? String(item.subtitle).trim() : '';
            const resolvedUrl = base ? resolveMediaUrl(item.url, base) : item.url;
            const resolvedSubtitle =
                subtitleRaw && base
                    ? resolveMediaUrl(subtitleRaw, base)
                    : subtitleRaw.startsWith('http://') || subtitleRaw.startsWith('https://')
                      ? subtitleRaw
                      : subtitleRaw;
            return {
                ...item,
                url: resolvedUrl,
                subtitle: resolvedSubtitle,
            };
        });
    }, [items, mediaBaseUrl]);

    const prevPlaybackLen = playbackItemsLengthRef.current;
    const prevPlaybackItems = playbackItemsRef.current;
    const nextPlaybackLen = playbackItems.length;
    const activeIdxForTransition = activeIndexRef.current;

    if (
        nextPlaybackLen > prevPlaybackLen &&
        prevPlaybackItems[activeIdxForTransition]?.id ===
            playbackItems[activeIdxForTransition]?.id
    ) {
        postRenderTransitionRef.current = 'append-play';
    }
    if (nextPlaybackLen > 0 && activeIdxForTransition > nextPlaybackLen - 1) {
        postRenderTransitionRef.current = 'shrink-clamp';
        shrinkTargetRef.current = nextPlaybackLen - 1;
    }

    playbackItemsLengthRef.current = nextPlaybackLen;
    playbackItemsRef.current = playbackItems;

    const openPreloadGate = useCallback(() => {
        if (preloadGateRef.current) return;
        preloadGateRef.current = true;
        setPreloadGate(true);
        preloadGateDisposeRef.current?.();
        preloadGateDisposeRef.current = null;
        preloadGateAttachedRef.current = null;
    }, []);

    const suppressNextPreloadUntilStable = useCallback((source: string, maxDelayMs = 6000) => {
        if (suppressNextPreloadTimerRef.current != null) {
            window.clearTimeout(suppressNextPreloadTimerRef.current);
            suppressNextPreloadTimerRef.current = null;
        }

        setSuppressNextPreload(true);
        feedDbg('suppress next preload', { source, maxDelayMs });

        const startedAt = Date.now();
        const check = () => {
            const player = playerByIndexRef.current.get(activeIndexRef.current);
            const video = player?.video as HTMLVideoElement | undefined;
            const t = video ? Math.round(video.currentTime * 100) / 100 : null;
            const stable = Boolean(
                video &&
                    !video.paused &&
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                    video.currentTime >= 0.8,
            );
            const expired = Date.now() - startedAt >= maxDelayMs;

            if (stable || expired) {
                suppressNextPreloadTimerRef.current = null;
                setSuppressNextPreload(false);
                feedDbg('resume next preload', {
                    source,
                    reason: stable ? 'stable' : 'timeout',
                    paused: video?.paused ?? null,
                    readyState: video?.readyState ?? null,
                    t,
                });
                return;
            }

            suppressNextPreloadTimerRef.current = window.setTimeout(check, 250);
        };

        suppressNextPreloadTimerRef.current = window.setTimeout(check, 250);
    }, []);

    const getBufferedAhead = useCallback((video: HTMLVideoElement): number => {
        const t = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
            const start = video.buffered.start(i);
            const end = video.buffered.end(i);
            if (t >= start && t <= end) return end - t;
        }
        return 0;
    }, []);

    const attachPreloadGateOnce = useCallback(
        (player: Player) => {
            if (preloadGateRef.current) return;
            if (preloadGateAttachedRef.current === player) return;

            preloadGateDisposeRef.current?.();
            preloadGateAttachedRef.current = player;

            const video = player.video as HTMLVideoElement | undefined;
            const checkBuffer = () => {
                if (preloadGateRef.current) return;
                if (video && getBufferedAhead(video) >= RESUME_PLAY_WATER_LEVEL) {
                    openPreloadGate();
                }
            };

            const onPlaying = () => {
                openPreloadGate();
                checkBuffer();
            };

            player.on('playing', onPlaying);

            let onTimeUpdate: (() => void) | null = null;
            if (video) {
                onTimeUpdate = () => checkBuffer();
                video.addEventListener('timeupdate', onTimeUpdate);
            }

            preloadGateDisposeRef.current = () => {
                player.off('playing', onPlaying);
                if (video && onTimeUpdate) {
                    video.removeEventListener('timeupdate', onTimeUpdate);
                }
            };
        },
        [getBufferedAhead, openPreloadGate],
    );

    const attachActivePlaybackHooks = useCallback(
        (player: Player) => {
            attachPreloadGateOnce(player);
            iosChainRetryDisposeRef.current?.();
            iosChainRetryDisposeRef.current = bindIosChainPlayRetry(player, () =>
                isIosChainWantPlay(),
            );
            iosPauseRecoverDisposeRef.current?.();
            const hookedPlayer = player;
            iosPauseRecoverDisposeRef.current = bindIosActivePauseRecover(hookedPlayer, () => {
                const idx = activeIndexRef.current;
                return playerByIndexRef.current.get(idx) === hookedPlayer;
            });
            activeNeighborPrimeDisposeRef.current?.();
            activeNeighborPrimeDisposeRef.current = attachActiveNeighborPrime(
                () => activeIndexRef.current,
                (activeIdx) => {
                    const nextPlayer = playerByIndexRef.current.get(activeIdx + 1);
                    const nextUrl = playbackItemsRef.current[activeIdx + 1]?.url ?? '';
                    if (!nextPlayer || !nextUrl) return null;
                    return { player: nextPlayer, url: nextUrl };
                },
            );
        },
        [attachPreloadGateOnce],
    );

    const slots = useMemo(
        () =>
            buildPlayerSlots(
                playbackItems,
                activeIndex,
                preloadNext && preloadGate && !suppressNextPreload,
            ),
        [playbackItems, activeIndex, preloadNext, preloadGate, suppressNextPreload],
    );

    const activeEpisodeKey = playbackItems[activeIndex]?.id ?? activeIndex;
    const getActivePlayer = useCallback(
        () => playerByIndexRef.current.get(activeIndexRef.current) ?? null,
        [],
    );

    const flushIosPendingEndedAdvance = useCallback(() => {
        const from = iosPendingEndedFromRef.current;
        if (from == null) return;
        iosPendingEndedFromRef.current = null;
        const waitedNativeExit = iosWaitNativeExitRef.current;
        iosWaitNativeExitRef.current = false;
        iosSkipResumeAfterExitRef.current = true;
        window.setTimeout(() => {
            iosSkipResumeAfterExitRef.current = false;
        }, 2500);

        const run = () => {
            if (from !== activeIndexRef.current) return;

            const len = playbackItemsLengthRef.current;
            feedDbg('ios ended flush after exit fs', {
                from,
                len,
                waitedNativeExit,
            });
            if (showNextEpisodeRef.current) {
                if (from < len - 1) {
                    advanceAfterEndedRef.current(from);
                } else {
                    onNextEpisodeRef.current?.();
                }
                return;
            }
            if (from < len - 1) {
                advanceAfterEndedRef.current(from);
            }
        };

        if (waitedNativeExit) {
            window.setTimeout(run, 250);
            return;
        }

        run();
    }, []);

    const onIosNativeFullscreenEnd = useCallback((): boolean => {
        const hadPending = iosPendingEndedFromRef.current != null;
        if (hadPending) {
            flushIosPendingEndedAdvance();
        }
        return hadPending || iosSkipResumeAfterExitRef.current;
    }, [flushIosPendingEndedAdvance]);

    const feedFullscreen = useFeedPlayerFullscreen({
        fullscreenTargetRef: resolvedFullscreenTargetRef,
        isDesktop,
        activeEpisodeKey,
        getActivePlayer,
        onFullscreenUiChange,
        onIosNativeFullscreenEnd,
        enabled: fullscreenEnabled,
    });
    const feedFullscreenRef = useRef(feedFullscreen);
    feedFullscreenRef.current = feedFullscreen;

    const chromeVideoTapRef = useRef<((target: EventTarget | null) => boolean) | null>(null);
    const chromeTapSuppressRef = useRef(false);
    const chromeVisibleRef = useRef(false);
    const infoBumpRef = useRef<(() => void) | null>(null);
    const hasTopContent = Boolean(controlsTopContent);
    const fullscreenEnabledRef = useRef(fullscreenEnabled);
    fullscreenEnabledRef.current = fullscreenEnabled;
    const handleFullscreenVideoTap = useCallback(
        (target?: EventTarget | null) => chromeVideoTapRef.current?.(target ?? null) ?? false,
        [],
    );

    const fullscreenControls = useMemo(
        () =>
            fullscreenEnabled
                ? {
                      isFullscreenUi: feedFullscreen.isFullscreenUi,
                      toggleFullscreen: feedFullscreen.toggleFullscreen,
                  }
                : undefined,
        [
            fullscreenEnabled,
            feedFullscreen.isFullscreenUi,
            feedFullscreen.toggleFullscreen,
        ],
    );

    const handleToolbarNextEpisode = useCallback(() => {
        const current = activeIndexRef.current;
        const len = playbackItemsLengthRef.current;
        if (current < len - 1) {
            navigateRef.current('next');
            return;
        }
        if (fullscreenEnabled && feedFullscreenRef.current.isFullscreenUi) {
            feedFullscreenRef.current.markFullscreenTransition();
        }
        onNextEpisodeRef.current?.();
    }, [fullscreenEnabled]);

    /** /video：全屏时 active 仅 cover、无 player → 退出全屏（避免无控制条卡死） */
    useEffect(() => {
        if (!isVideoH5Feed || isDesktop || !feedFullscreen.isFullscreenUi) return;

        const idx = activeIndexRef.current;
        const player = playerByIndexRef.current.get(idx);
        const url = playbackItemsRef.current[idx]?.url ?? '';
        if (player && url) return;

        void feedFullscreenRef.current.forceExitFullscreen();
    }, [isVideoH5Feed, feedFullscreen.isFullscreenUi, activeIndex, isDesktop]);

    /** MD §2.5：切条后唯一 play — setTimeout(() => play()) */
    const dispatchActivePlay = useCallback((source: string) => {
        if (isUserHoldPause()) {
            feedDbg('dispatch skip holdPause', { source });
            return;
        }
        const idx = activeIndexRef.current;
        const player = playerByIndexRef.current.get(idx);
        const url = playbackItemsRef.current[idx]?.url ?? '';
        feedDbg('dispatch', {
            source,
            idx,
            hasPlayer: Boolean(player),
            hasUrl: Boolean(url),
            gesture: isUserGestureActive(),
            pending: pendingPlayIndexRef.current,
        });
        if (!player || !url) return;
        feedVideoMp4FromPlayer('dispatch mp4', player, {
            source,
            idx,
            urlTail: url.slice(-64),
        });
        resumePlayerLoading(player, url, { autoplay: false });
        scheduleActivePlay(player);
    }, []);

    const dispatchActivePlayRef = useRef(dispatchActivePlay);
    dispatchActivePlayRef.current = dispatchActivePlay;

    const openPreloadGateRef = useRef(openPreloadGate);
    openPreloadGateRef.current = openPreloadGate;

    const getCurrentSlideHeight = useCallback(
        () =>
            slideHeightRef.current ||
            scrollerRef.current?.clientHeight ||
            (typeof window === 'undefined' ? 0 : window.innerHeight),
        [],
    );

    const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
        const nextOffset = getCurrentSlideHeight() * index;
        setFeedOffsetY(nextOffset);
        setSlideAnimating(behavior !== 'auto');
    }, [getCurrentSlideHeight, setFeedOffsetY, setSlideAnimating]);

    const syncActiveIndex = useCallback((next: number, direction?: FeedNavigateDirection) => {
        const len = playbackItemsLengthRef.current;
        if (len === 0) return;

        const clamped = Math.min(Math.max(0, next), len - 1);
        const prev = activeIndexRef.current;
        if (clamped === prev && direction === undefined) return;

        if (clamped !== prev) {
            if (fullscreenEnabled && feedFullscreenRef.current.isFullscreenUi) {
                feedFullscreenRef.current.markFullscreenTransition();
            }
            setUserHoldPause(false);
            activeNeighborPrimeDisposeRef.current?.();
            activeNeighborPrimeDisposeRef.current = null;
            const oldPlayer = playerByIndexRef.current.get(prev);
            const keepScheduled = endedStackPlayRef.current;
            if (oldPlayer) pausePlayer(oldPlayer, { keepScheduledPlay: keepScheduled });

            const newPlayer = playerByIndexRef.current.get(clamped);
            if (newPlayer && playbackItemsRef.current[clamped]?.url) {
                pendingPlayIndexRef.current = null;
            } else {
                pendingPlayIndexRef.current = clamped;
            }
            feedDbg('sync', {
                prev,
                next: clamped,
                direction,
                hasNewPlayer: Boolean(newPlayer),
                pending: pendingPlayIndexRef.current,
            });
        }

        activeIndexRef.current = clamped;
        setActiveIndex(clamped);
        setFeedDbgContext({ activeIndex: clamped, len });
        const activeItemId = playbackItemsRef.current[clamped]?.id;
        playerRegistry.setActiveId(activeItemId ?? null);
        const currentPlayer = playerByIndexRef.current.get(clamped);
        if (currentPlayer) {
            setActivePlayer(currentPlayer);
            if (clamped !== prev) {
                attachActivePlaybackHooks(currentPlayer);
            }
        }

        const nextNeighbor = playerByIndexRef.current.get(clamped + 1);
        const nextUrl = playbackItemsRef.current[clamped + 1]?.url ?? '';
        if (nextNeighbor && nextUrl) {
            primeDouyinNeighborBuffer(nextNeighbor, nextUrl);
        }

        if (direction !== undefined && clamped !== prev) {
            onIndexChangeRef.current?.(clamped, direction);
        }
    }, [attachActivePlaybackHooks, fullscreenEnabled]);

    const syncActiveIndexRef = useRef(syncActiveIndex);
    syncActiveIndexRef.current = syncActiveIndex;

    // MD-ref v5：append / shrink 单次 ref 过渡（非 items.length useEffect 堆砌）
    useLayoutEffect(() => {
        const kind = postRenderTransitionRef.current;
        if (!kind) return;
        postRenderTransitionRef.current = null;

        if (kind === 'shrink-clamp') {
            const target = shrinkTargetRef.current;
            shrinkTargetRef.current = null;
            if (target != null) {
                syncActiveIndexRef.current(target);
            }
            return;
        }

        if (kind === 'append-play') {
            const idx = activeIndexRef.current;
            const itemId = playbackItemsRef.current[idx]?.id;
            const player =
                (itemId != null ? playerRegistry.get(itemId) : undefined) ??
                playerByIndexRef.current.get(idx);
            if (!player) return;

            const video = player.video as HTMLVideoElement | undefined;
            if (video && !video.paused) {
                feedDbg('append-play skip playing', { idx });
                return;
            }

            feedDbg('append-play resume', { idx, paused: video?.paused ?? true });
            if (detectPlatform().isIOS && !readMutedPreference()) {
                markChainAutoplay();
            }
            scheduleActivePlay(player);
        }
    });

    const navigate = useCallback(
        (direction: FeedNavigateDirection) => {
            const current = activeIndexRef.current;
            const delta = direction === 'prev' ? -1 : 1;
            const next = Math.min(
                Math.max(0, current + delta),
                playbackItemsLengthRef.current - 1,
            );
            if (next === current) return;

            markUserGesture(3500);
            const navDirection: FeedNavigateDirection =
                direction === 'auto' ? 'next' : direction;
            syncActiveIndex(next, navDirection);
            scrollToIndex(next);
            feedDbg('navigate', { direction, from: current, to: next, gesture: isUserGestureActive() });
            requestAnimationFrame(() => {
                dispatchActivePlayRef.current('navigate');
            });
        },
        [scrollToIndex, syncActiveIndex],
    );
    navigateRef.current = navigate;

    const goToIndex = useCallback(
        (target: number) => {
            const current = activeIndexRef.current;
            const len = playbackItemsLengthRef.current;
            const next = Math.min(Math.max(0, target), len - 1);
            if (next === current) return;

            markUserGesture(3500);
            const direction: FeedNavigateDirection = next > current ? 'next' : 'prev';
            syncActiveIndex(next, direction);
            scrollToIndex(next);
            feedDbg('goToIndex', { from: current, to: next, direction });
            requestAnimationFrame(() => {
                dispatchActivePlayRef.current('navigate');
            });
        },
        [scrollToIndex, syncActiveIndex],
    );
    const goToIndexRef = useRef(goToIndex);
    goToIndexRef.current = goToIndex;

    const handleFeedTouchStart = useCallback(
        (event: ReactTouchEvent<HTMLDivElement>) => {
            const touch = event.touches[0];
            if (!touch || isVerticalFeedControlTarget(event.target)) {
                touchActiveRef.current = false;
                return;
            }

            touchActiveRef.current = true;
            setSlideAnimating(false);
            const baseOffset = isFirstTouchRef.current
                ? getCurrentSlideHeight() * activeIndexRef.current
                : offsetYRef.current;
            if (isFirstTouchRef.current) {
                setFeedOffsetY(baseOffset);
            }
            touchStartYRef.current = touch.clientY;
            lastTouchYRef.current = baseOffset + touch.clientY;
            setUserTouching(true);
            markUserGesture(isUserAudioUnlocked() ? 5000 : 3500);
            if (detectPlatform().isIOS) {
                openPreloadGateRef.current();
            }
        },
        [getCurrentSlideHeight, setFeedOffsetY, setSlideAnimating],
    );

    const handleFeedTouchMove = useCallback(
        (event: ReactTouchEvent<HTMLDivElement>) => {
            if (!touchActiveRef.current) return;
            const touch = event.touches[0];
            if (!touch) return;

            markUserGesture(isUserAudioUnlocked() ? 5000 : 3500);
            const height = getCurrentSlideHeight();
            const maxOffset = Math.max(0, height * (playbackItemsLengthRef.current - 1));
            const nextOffset = Math.min(
                Math.max(0, lastTouchYRef.current - touch.clientY),
                maxOffset,
            );
            setFeedOffsetY(nextOffset);
            if (event.cancelable) {
                event.preventDefault();
            }
        },
        [getCurrentSlideHeight, setFeedOffsetY],
    );

    const handleFeedTouchEnd = useCallback(
        (event: ReactTouchEvent<HTMLDivElement>) => {
            if (!touchActiveRef.current) return;
            touchActiveRef.current = false;
            setUserTouching(false);

            const touch = event.changedTouches[0];
            const endY = touch?.clientY ?? touchStartYRef.current;
            const deltaY = touchStartYRef.current - endY;
            const current = activeIndexRef.current;
            const len = playbackItemsLengthRef.current;
            let next = current;

            markUserGesture(isUserAudioUnlocked() ? 5000 : 3500);
            if (Math.abs(deltaY) > FEED_TOUCH_THRESHOLD_PX) {
                next = Math.min(Math.max(0, current + (deltaY > 0 ? 1 : -1)), len - 1);
            }
            isFirstTouchRef.current = false;

            if (next === current) {
                scrollToIndex(current);
                feedDbg('touch snap', { index: current, deltaY });
                return;
            }

            const direction: FeedNavigateDirection = next > current ? 'next' : 'prev';
            syncActiveIndex(next, direction);
            scrollToIndex(next);
            feedDbg('touch', {
                from: current,
                to: next,
                direction,
                deltaY,
                gesture: isUserGestureActive(),
            });
            requestAnimationFrame(() => {
                dispatchActivePlayRef.current('touch');
            });
        },
        [scrollToIndex, syncActiveIndex],
    );

    const handleFeedTouchCancel = useCallback(() => {
        if (!touchActiveRef.current) return;
        touchActiveRef.current = false;
        setUserTouching(false);
        isFirstTouchRef.current = false;
        scrollToIndex(activeIndexRef.current);
    }, [scrollToIndex]);

    useEffect(() => {
        if (!feedNavigateRef) return;
        feedNavigateRef.current = {
            next: () => navigateRef.current('next'),
            prev: () => navigateRef.current('prev'),
            goToIndex: (index) => goToIndexRef.current(index),
        };
        return () => {
            feedNavigateRef.current = null;
        };
    }, [feedNavigateRef]);

    // Root-level non-touch bindings stay outside the transform swipe chain.
    useEffect(() => {
        const root = scrollerRef.current;
        if (!root) return;

        const len = playbackItemsLengthRef.current;
        if (len > 0 && activeIndexRef.current > len - 1) {
            syncActiveIndexRef.current(len - 1);
        }

        const wheel = bindWheelNavigate(root, (dir) => {
            navigateRef.current(dir === 'next' ? 'next' : 'prev');
        });
        const chromeTapStartRef = { current: null as { x: number; y: number } | null };

        const onChromeTouchStart = (event: TouchEvent) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('.douyin-player-controls, .video-player-center-play')) return;
            const touch = event.touches[0];
            if (!touch) return;
            chromeTapStartRef.current = { x: touch.clientX, y: touch.clientY };
        };

        const onChromeTouchEnd = (event: TouchEvent) => {
            if (!fullscreenEnabledRef.current || !feedFullscreenRef.current.isFullscreenUi) return;
            if (
                event.target instanceof Element &&
                event.target.closest('.douyin-player-controls')
            ) {
                return;
            }
            const start = chromeTapStartRef.current;
            chromeTapStartRef.current = null;
            if (!start) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            if (
                Math.abs(touch.clientX - start.x) > 12 ||
                Math.abs(touch.clientY - start.y) > 12
            ) {
                return;
            }
            if (!chromeVideoTapRef.current?.(event.target)) return;
            event.preventDefault();
        };

        const onChromeTouchCancel = () => {
            chromeTapStartRef.current = null;
        };

        const chromeCapture = { capture: true } as const;
        root.addEventListener('touchstart', onChromeTouchStart, { ...chromeCapture, passive: true });
        root.addEventListener('touchend', onChromeTouchEnd, { ...chromeCapture, passive: false });
        root.addEventListener('touchcancel', onChromeTouchCancel, { ...chromeCapture, passive: true });

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
                navigateRef.current('next');
            } else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
                navigateRef.current('prev');
            }
        };

        window.addEventListener('keydown', onKey);

        return () => {
            wheel.dispose();
            root.removeEventListener('touchstart', onChromeTouchStart, chromeCapture);
            root.removeEventListener('touchend', onChromeTouchEnd, chromeCapture);
            root.removeEventListener('touchcancel', onChromeTouchCancel, chromeCapture);
            window.removeEventListener('keydown', onKey);
        };
    }, []);

    const advanceAfterEnded = useCallback(
        (current: number) => {
            const len = playbackItemsLengthRef.current;
            if (current >= len - 1) {
                if (showNextEpisodeRef.current) {
                    onNextEpisodeRef.current?.();
                }
                return;
            }

            const next = current + 1;
            const nextPlayer = playerByIndexRef.current.get(next);
            const nextUrl = playbackItemsRef.current[next]?.url ?? '';

            endedStackPlayRef.current = false;
            if (detectPlatform().isIOS && !readMutedPreference()) {
                if (tryPlayIosChainInEndedStack(nextPlayer, nextUrl)) {
                    endedStackPlayRef.current = true;
                    setIosChainWantPlay(true);
                    suppressNextPreloadUntilStable('ended-stack');
                }
            }

            markUserGesture(3500);
            syncActiveIndex(next, 'next');
            scrollToIndex(next);
            feedDbg('advance after ended', {
                from: current,
                to: next,
                endedStack: endedStackPlayRef.current,
            });

            if (!endedStackPlayRef.current) {
                markChainAutoplay();
                dispatchActivePlayRef.current('ended-auto');
            }
        },
        [scrollToIndex, suppressNextPreloadUntilStable, syncActiveIndex],
    );
    advanceAfterEndedRef.current = advanceAfterEnded;

    /** iOS 沉浸/容器全屏：ended 后等 UI 退出再切条（原生全屏走 webkitendfullscreen） */
    useEffect(() => {
        if (!detectPlatform().isIOS || !fullscreenEnabled) return;
        if (feedFullscreen.isFullscreenUi) return;
        if (iosWaitNativeExitRef.current) return;
        flushIosPendingEndedAdvance();
    }, [feedFullscreen.isFullscreenUi, flushIosPendingEndedAdvance, fullscreenEnabled]);

    /** 对齐 foryou ForYouPlayer videoEnded：feedHasNext → 切条 / loadMore */
    const onVideoEnded = useCallback(
        (index: number) => {
            if (index !== activeIndexRef.current) return;
            const current = activeIndexRef.current;
            const len = playbackItemsLengthRef.current;
            if (len === 0) return;

            feedDbg('ended', { index, active: current, len });
            feedVideoMp4FromPlayer('ended mp4', playerByIndexRef.current.get(current), {
                index,
            });

            if (
                detectPlatform().isIOS &&
                fullscreenEnabledRef.current &&
                feedFullscreenRef.current.isFullscreenUi
            ) {
                const video = getVideoEl(playerByIndexRef.current.get(current) ?? null);
                iosPendingEndedFromRef.current = current;
                iosWaitNativeExitRef.current = isIosNativeVideoFullscreen(video);
                feedDbg('ios ended defer until exit fs', {
                    current,
                    waitNative: iosWaitNativeExitRef.current,
                });
                void feedFullscreenRef.current.forceExitFullscreen();
                return;
            }

            if (showNextEpisodeRef.current) {
                if (current < len - 1) {
                    advanceAfterEnded(current);
                } else {
                    onNextEpisodeRef.current?.();
                }
                return;
            }

            if (current < len - 1) {
                advanceAfterEnded(current);
            }
        },
        [advanceAfterEnded],
    );

    const primeNeighborSlot = useCallback((index: number, player: Player) => {
        const active = activeIndexRef.current;
        const url = playbackItemsRef.current[index]?.url ?? '';
        if (!url || index === active) return;
        if (Math.abs(index - active) !== 1) return;
        primeDouyinNeighborBuffer(player, url);
    }, []);

    const handleSlotPlayerChange = useCallback(
        (index: number, player: Player | null) => {
            const itemId = playbackItemsRef.current[index]?.id;

            if (player) {
                playerByIndexRef.current.set(index, player);
                if (itemId != null) {
                    playerRegistry.register(itemId, player);
                }
                const active = activeIndexRef.current;
                if (Math.abs(index - active) <= PLAYER_WINDOW_RADIUS) {
                    if (index !== active) {
                        markNeighborMount(index);
                        feedDbg('neighbor mount', {
                            index,
                            active,
                            gesture: isUserGestureActive(),
                        });
                        const activeIdx = active;
                        requestAnimationFrame(() => {
                            if (activeIndexRef.current !== activeIdx) return;
                            const ap =
                                playerByIndexRef.current.get(activeIdx) ??
                                (() => {
                                    const id = playbackItemsRef.current[activeIdx]?.id;
                                    return id != null ? playerRegistry.get(id) : undefined;
                                })();
                            const av = ap?.video as HTMLVideoElement | undefined;
                            if (!av) return;
                            const snap = {
                                active: activeIdx,
                                neighbor: index,
                                paused: av.paused,
                                t: Math.round(av.currentTime * 100) / 100,
                                msSinceChainUnmute: msSinceChainUnmute(),
                            };
                            if (av.paused) {
                                feedDbg('STALL post-neighbor paused', snap);
                                recoverIosActiveChainIfPaused(av, 'post-neighbor');
                            } else {
                                feedDbg('post-neighbor active ok', snap);
                            }
                        });
                    }
                    primeNeighborSlot(index, player);
                }
            } else {
                playerByIndexRef.current.delete(index);
                if (itemId != null) {
                    playerRegistry.unregister(itemId);
                }
                if (index === activeIndexRef.current) return;
            }

            feedDbg('slot change', {
                index,
                hasPlayer: Boolean(player),
                active: index === activeIndexRef.current,
                pending: index === pendingPlayIndexRef.current,
                gesture: isUserGestureActive(),
            });

            const isActiveOrPending =
                index === activeIndexRef.current || index === pendingPlayIndexRef.current;
            if (player && isActiveOrPending) {
                if (index === pendingPlayIndexRef.current) {
                    pendingPlayIndexRef.current = null;
                }
                if (index === activeIndexRef.current && itemId != null) {
                    playerRegistry.setActiveId(itemId);
                }
                setActivePlayer(player);
                const skipEndedStack =
                    endedStackPlayRef.current && index === activeIndexRef.current;
                if (index === activeIndexRef.current) {
                    attachActivePlaybackHooks(player);
                }
                const url = playbackItemsRef.current[index]?.url ?? '';
                if (url && !skipEndedStack) {
                    resumePlayerLoading(player, url, { autoplay: false });
                }
                if (skipEndedStack) {
                    endedStackPlayRef.current = false;
                    const video = player.video as HTMLVideoElement | undefined;
                    if (video?.paused) {
                        feedDbg('slotChange ended-stack recover', {
                            index,
                            readyState: video.readyState,
                        });
                        setIosChainWantPlay(true);
                        playIosChainWithSound(video, 'slot-ended-recover');
                    } else {
                        setIosChainWantPlay(false);
                    }
                } else {
                    dispatchActivePlayRef.current('slotChange');
                }
            }
        },
        [attachActivePlaybackHooks, primeNeighborSlot],
    );

    useEffect(() => {
        return () => {
            if (suppressNextPreloadTimerRef.current != null) {
                window.clearTimeout(suppressNextPreloadTimerRef.current);
                suppressNextPreloadTimerRef.current = null;
            }
            iosChainRetryDisposeRef.current?.();
            iosChainRetryDisposeRef.current = null;
            iosPauseRecoverDisposeRef.current?.();
            iosPauseRecoverDisposeRef.current = null;
            activeNeighborPrimeDisposeRef.current?.();
            activeNeighborPrimeDisposeRef.current = null;
        };
    }, []);

    const bindSlideRef = useCallback((index: number, el: HTMLDivElement | null) => {
        if (el) itemRefs.current.set(index, el);
        else itemRefs.current.delete(index);
    }, []);

    if (!playbackItems.length) {
        return <div className={cn('douyin-feed-player douyin-feed-player--empty', className)} />;
    }

    return (
        <div
            ref={scrollerRef}
            className={cn('douyin-feed-player', className)}
            id="sliderVideo"
            onTouchStart={handleFeedTouchStart}
            onTouchMove={handleFeedTouchMove}
            onTouchEnd={handleFeedTouchEnd}
            onTouchCancel={handleFeedTouchCancel}
        >
            <div
                className="douyin-feed-player__track"
                style={{
                    transform: `translate3d(0, ${-offsetY}px, 0)`,
                    transition: animating
                        ? `transform ${FEED_SLIDE_ANIMATION_MS}ms ease-in-out`
                        : 'none',
                }}
            >
                {playbackItems.map((item, index) => {
                    const slot = slots.find((s) => s.index === index);
                    const feedAttrs = getFeedItemDataAttrs(index === activeIndex);
                    return (
                        <div
                            key={String(item.id)}
                            ref={(el) => bindSlideRef(index, el)}
                            className="douyin-feed-player__slide slider-video"
                            style={slideHeight ? { height: `${slideHeight}px` } : undefined}
                            {...feedAttrs}
                        >
                            {slot ? (
                                <>
                                    <DouyinPlayerSlot
                                        slot={slot}
                                        subtitleUrl={item.subtitle ?? ''}
                                        hasPreload={
                                            preloadNext && preloadGate && index === activeIndex + 1
                                        }
                                        onEnded={() => onVideoEnded(index)}
                                        onPlayerChange={handleSlotPlayerChange}
                                        onPlaybackModeChange={onPlaybackModeChange}
                                        onStall={onStall}
                                        onFullscreenVideoTap={
                                            fullscreenEnabled && index === activeIndex
                                                ? handleFullscreenVideoTap
                                                : undefined
                                        }
                                        chromeTapSuppressRef={chromeTapSuppressRef}
                                        infoBumpRef={
                                            hasTopContent && index === activeIndex
                                                ? infoBumpRef
                                                : undefined
                                        }
                                    />
                                    {showControls && index === activeIndex ? (
                                        <DouyinPlayerControls
                                            player={activePlayer}
                                            showNextEpisode={showNextEpisode}
                                            onNextEpisode={handleToolbarNextEpisode}
                                            topContent={controlsTopContent}
                                            fixedPlaybackSpeed={fixedPlaybackSpeed}
                                            isFullscreenUi={feedFullscreen.isFullscreenUi}
                                            fullscreen={fullscreenControls}
                                            chromeVideoTapRef={
                                                fullscreenEnabled ? chromeVideoTapRef : undefined
                                            }
                                            chromeTapSuppressRef={chromeTapSuppressRef}
                                            chromeVisibleRef={chromeVisibleRef}
                                            infoBumpRef={hasTopContent ? infoBumpRef : undefined}
                                            topContentResetKey={activeIndex}
                                        />
                                    ) : null}
                                </>
                            ) : (
                                <div className="douyin-feed-player__cover" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
