import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent,
    type MutableRefObject,
    type ReactNode,
    type TouchEvent,
} from 'react';
import { Minimize, Volume2, VolumeX } from 'lucide-react';
import type Player from 'xgplayer';

import nextEpisodeIcon from '@/assets/images/12164930-c692-11ef-a2d6-41216ff1602c.png';
import fullscreenIcon from '@/assets/video/icon_full@2x.png';
import { cn } from '@/lib/utils';
import { useMinWidth768 } from '@/hooks/useMinWidth768';

import '@/styles/video-vertical.scss';

import { isPlayerPaused, togglePlayerPlay } from './playerControlsApi';
import { useDouyinPlayerControlState } from './useDouyinPlayerControlState';
import { useOverlayAutoHide } from './useOverlayAutoHide';

import './douyin-player-controls.scss';

const FULLSCREEN_CHROME_HIDE_MS = 3000;
const CHROME_CLICK_SUPPRESS_MS = 400;

function suppressFollowingClick(ref: MutableRefObject<boolean> | undefined) {
    if (!ref) return;
    ref.current = true;
    window.setTimeout(() => {
        ref.current = false;
    }, CHROME_CLICK_SUPPRESS_MS);
}

function isChromeInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
        target.closest(
            'button, .video-player-progress-scrub, .video-player-h5-next, .video-player-h5-fullscreen, .video-player-h5-speed, .video-player-h5-mute',
        ),
    );
}

type DouyinPlayerControlsProps = {
    player: Player | null;
    className?: string;
    showNextEpisode?: boolean;
    onNextEpisode?: () => void;
    /** info / Watch Full 等，拼在进度条之上（与 foryou 同一底栏容器） */
    topContent?: ReactNode;
    /** for-demo / For You：固定 1.0x，隐藏倍速按钮 */
    fixedPlaybackSpeed?: boolean;
    isFullscreenUi?: boolean;
    fullscreen?: {
        isFullscreenUi: boolean;
        toggleFullscreen: () => Promise<boolean>;
    };
    /** 全屏：视频区轻点切换底栏（由 DouyinFeedPlayer 桥接到 slot） */
    chromeVideoTapRef?: MutableRefObject<((target: EventTarget | null) => boolean) | null>;
    chromeTapSuppressRef?: MutableRefObject<boolean>;
    /** 全屏底栏是否展示（与 fade 同步，供 feed 层读取） */
    chromeVisibleRef?: MutableRefObject<boolean>;
    /** Feed：视频区 tap 唤出 info（由 DouyinFeedPlayer 桥接到 slot） */
    infoBumpRef?: MutableRefObject<(() => void) | null>;
    /** 切条/切集时重置 info 展示计时 */
    topContentResetKey?: number;
};

function stopBubble(event: MouseEvent | TouchEvent) {
    event.stopPropagation();
}

export function DouyinPlayerControls({
    player,
    className,
    showNextEpisode = false,
    onNextEpisode,
    topContent,
    fixedPlaybackSpeed = false,
    isFullscreenUi = false,
    fullscreen,
    chromeVideoTapRef,
    chromeTapSuppressRef,
    chromeVisibleRef,
    infoBumpRef,
    topContentResetKey,
}: DouyinPlayerControlsProps) {
    const isDesktop = useMinWidth768();
    const ctl = useDouyinPlayerControlState(player, { fixedPlaybackSpeed, fullscreen });
    const feedBottomLayout = Boolean(topContent) && !isFullscreenUi;
    const infoAutoHide = useOverlayAutoHide(feedBottomLayout, topContentResetKey);
    const progressScrubRef = useRef<HTMLDivElement | null>(null);
    const [chromeHidden, setChromeHidden] = useState(false);
    const [scrubbing, setScrubbing] = useState(false);
    const chromeTimerRef = useRef<number | null>(null);
    const chromeVisibleRefLocal = useRef(false);

    const syncChromeVisible = useCallback(
        (visible: boolean) => {
            chromeVisibleRefLocal.current = visible;
            if (chromeVisibleRef) chromeVisibleRef.current = visible;
            setChromeHidden(!visible);
        },
        [chromeVisibleRef],
    );

    const isChromeVisible = () => chromeVisibleRefLocal.current;

    const clearChromeTimer = useCallback(() => {
        if (chromeTimerRef.current != null) {
            window.clearTimeout(chromeTimerRef.current);
            chromeTimerRef.current = null;
        }
    }, []);

    const hideChrome = useCallback(() => {
        clearChromeTimer();
        syncChromeVisible(false);
    }, [clearChromeTimer, syncChromeVisible]);

    const showChrome = useCallback(() => {
        syncChromeVisible(true);
        clearChromeTimer();
        chromeTimerRef.current = window.setTimeout(() => {
            syncChromeVisible(false);
            chromeTimerRef.current = null;
        }, FULLSCREEN_CHROME_HIDE_MS);
    }, [clearChromeTimer, syncChromeVisible]);

    const bumpChrome = useCallback(() => {
        if (isFullscreenUi) {
            showChrome();
        } else if (feedBottomLayout) {
            infoAutoHide.bump();
        }
    }, [feedBottomLayout, infoAutoHide, isFullscreenUi, showChrome]);

    useEffect(() => {
        if (!infoBumpRef) return;
        const bump = feedBottomLayout ? infoAutoHide.bump : null;
        infoBumpRef.current = bump;
        return () => {
            if (infoBumpRef.current === bump) {
                infoBumpRef.current = null;
            }
        };
    }, [feedBottomLayout, infoAutoHide.bump, infoBumpRef]);

    const toggleChromeFromTap = useCallback(
        (target: EventTarget | null): boolean => {
            if (!isFullscreenUi) return false;
            if (isChromeInteractiveTarget(target)) return false;
            if (!isChromeVisible()) {
                showChrome();
                if (isPlayerPaused(player)) {
                    void togglePlayerPlay(player);
                }
            } else {
                hideChrome();
            }
            suppressFollowingClick(chromeTapSuppressRef);
            return true;
        },
        [chromeTapSuppressRef, hideChrome, isFullscreenUi, player, showChrome],
    );

    useEffect(() => {
        if (!isFullscreenUi) {
            clearChromeTimer();
            syncChromeVisible(true);
            setScrubbing(false);
            return;
        }
        hideChrome();
    }, [clearChromeTimer, hideChrome, isFullscreenUi, syncChromeVisible]);

    useEffect(() => () => clearChromeTimer(), [clearChromeTimer]);

    useEffect(() => {
        if (!chromeVideoTapRef) return;
        const handler = isFullscreenUi ? toggleChromeFromTap : null;
        chromeVideoTapRef.current = handler;
        return () => {
            if (chromeVideoTapRef.current === handler) {
                chromeVideoTapRef.current = null;
            }
        };
    }, [chromeVideoTapRef, isFullscreenUi, toggleChromeFromTap]);

    const onChromeShellTap = useCallback(
        (event: MouseEvent | TouchEvent) => {
            if (!isFullscreenUi) return;
            if (event.type === 'click') {
                if (chromeTapSuppressRef?.current) return;
                // 仅 H5 触摸端走 touchend；PC（含触屏 PC）始终走 click
                if (!isDesktop && 'ontouchstart' in window) return;
            }
            if (isChromeInteractiveTarget(event.target)) return;
            toggleChromeFromTap(event.target);
        },
        [chromeTapSuppressRef, isDesktop, isFullscreenUi, toggleChromeFromTap],
    );

    const seekFromClientX = (clientX: number, rect: DOMRect) => {
        if (!rect.width) return;
        const ratio = (clientX - rect.left) / rect.width;
        ctl.onSeekRatio(Math.min(Math.max(ratio, 0), 1));
    };

    const seekFromScrubPointer = (clientX: number) => {
        const el = progressScrubRef.current;
        if (!el) return;
        seekFromClientX(clientX, el.getBoundingClientRect());
    };

    useEffect(() => {
        if (!ctl.progressDragging) return;

        const onMouseMove = (event: globalThis.MouseEvent) => {
            seekFromScrubPointer(event.clientX);
        };
        const onMouseUp = () => {
            ctl.setProgressDragging(false);
            setScrubbing(false);
            bumpChrome();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [bumpChrome, ctl.progressDragging, ctl.onSeekRatio, ctl.setProgressDragging]);

    const onFeedBottomHiddenRevealCapture = useCallback(
        (event: MouseEvent | TouchEvent) => {
            if (!feedBottomLayout || infoAutoHide.visible) return;
            stopBubble(event);
            infoAutoHide.bump();
        },
        [feedBottomLayout, infoAutoHide.bump, infoAutoHide.visible],
    );

    return (
        <div
            className={cn(
                'douyin-player-controls video-player-root video-player-ui',
                isFullscreenUi && chromeHidden && 'video-player-ui--chrome-hidden',
                scrubbing && 'video-player-ui--scrubbing',
                className,
            )}
            onClick={stopBubble}
            onClickCapture={onChromeShellTap}
            onTouchStart={stopBubble}
            onTouchEnd={stopBubble}
            onTouchEndCapture={onChromeShellTap}
            onPointerDown={stopBubble}
            onPointerUp={stopBubble}
            onMouseDown={stopBubble}
        >
            <div
                className={cn(
                    'video-player-h5-bottom w-full',
                    (isFullscreenUi || !feedBottomLayout) && 'video-player-h5-bottom--fullscreen',
                    feedBottomLayout &&
                        !infoAutoHide.visible &&
                        'video-player-h5-bottom--feed-hidden',
                )}
                aria-hidden={feedBottomLayout ? !infoAutoHide.visible : undefined}
                style={
                    isFullscreenUi
                        ? {
                              opacity: chromeHidden ? 0 : 1,
                              transition: 'opacity 0.4s ease-in-out',
                          }
                        : undefined
                }
                onPointerDownCapture={onFeedBottomHiddenRevealCapture}
                onTouchStartCapture={onFeedBottomHiddenRevealCapture}
                onPointerDown={
                    feedBottomLayout
                        ? (e) => {
                              stopBubble(e);
                              infoAutoHide.bump();
                          }
                        : undefined
                }
            >
                {feedBottomLayout ? topContent : null}
                <div className="video-player-h5-progress-row">
                    <div
                        ref={progressScrubRef}
                        className="video-player-progress-scrub video-player-h5-progress-track-wrap swiper-no-swiping flex-1 flex items-center justify-center min-w-0"
                        data-vertical-swipe-ignore
                        onMouseDown={(e) => {
                            stopBubble(e);
                            if (feedBottomLayout && !infoAutoHide.visible) {
                                infoAutoHide.bump();
                                return;
                            }
                            bumpChrome();
                            setScrubbing(true);
                            ctl.setProgressDragging(true);
                            seekFromScrubPointer(e.clientX);
                        }}
                        onMouseEnter={() => ctl.setProgressHover(true)}
                        onMouseLeave={() => {
                            if (!ctl.progressDragging) {
                                ctl.setProgressHover(false);
                            }
                        }}
                        onTouchStart={(e) => {
                            stopBubble(e);
                            const touch = e.touches[0];
                            if (!touch) return;
                            if (feedBottomLayout && !infoAutoHide.visible) {
                                infoAutoHide.bump();
                                return;
                            }
                            bumpChrome();
                            setScrubbing(true);
                            ctl.setProgressDragging(true);
                            seekFromClientX(touch.clientX, e.currentTarget.getBoundingClientRect());
                        }}
                        onTouchMove={(e) => {
                            const touch = e.touches[0];
                            if (!touch || !ctl.progressDragging) return;
                            seekFromClientX(touch.clientX, e.currentTarget.getBoundingClientRect());
                        }}
                        onTouchEnd={() => {
                            ctl.setProgressDragging(false);
                            setScrubbing(false);
                            bumpChrome();
                        }}
                    >
                        <div className="video-player-progress-track w-full h-1 bg-white/50 rounded-full overflow-visible">
                            <div
                                className="bg-white/80 h-1 rounded-full relative"
                                style={{ width: `${ctl.progressRatio * 100}%` }}
                            >
                                <span
                                    className={cn(
                                        'video-player-progress-thumb',
                                        (ctl.progressHover || ctl.progressDragging) &&
                                            'video-player-progress-thumb--visible',
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="video-player-h5-toolbar">
                    <div className="video-player-h5-time">
                        {ctl.currentLabel} / {ctl.durationLabel}
                    </div>
                    <div className="video-player-h5-toolbar-actions">
                        {!fixedPlaybackSpeed ? (
                            <div
                                className="video-player-h5-speed"
                                onClick={(e) => {
                                    stopBubble(e);
                                    bumpChrome();
                                    ctl.onCycleSpeed();
                                }}
                            >
                                {ctl.speedLabel}
                            </div>
                        ) : null}
                        <button
                            type="button"
                            data-vertical-swipe-ignore
                            className="video-player-h5-mute shrink-0 flex items-center justify-center border-0 bg-transparent p-0 text-white cursor-pointer"
                            onClick={(e) => {
                                stopBubble(e);
                                bumpChrome();
                                ctl.onToggleMute();
                            }}
                            aria-label={ctl.muted ? 'Unmute' : 'Mute'}
                        >
                            {ctl.muted ? (
                                <VolumeX className="w-5 h-5" aria-hidden />
                            ) : (
                                <Volume2 className="w-5 h-5" aria-hidden />
                            )}
                        </button>
                        {showNextEpisode ? (
                            <div
                                className="video-player-next-episode-trigger video-player-h5-next text-white flex items-center justify-center cursor-pointer"
                                onClick={(e) => {
                                    stopBubble(e);
                                    bumpChrome();
                                    onNextEpisode?.();
                                }}
                            >
                                <img
                                    src={nextEpisodeIcon}
                                    alt="next episode"
                                    className="video-player-next-episode-icon"
                                />
                            </div>
                        ) : null}
                        <div
                            className="video-player-h5-fullscreen text-white flex shrink-0 items-center justify-center cursor-pointer"
                            onClick={(e) => {
                                stopBubble(e);
                                bumpChrome();
                                void ctl.onToggleFullscreen();
                            }}
                        >
                            {ctl.isFullscreen ? (
                                <Minimize className="w-5 h-5" aria-hidden />
                            ) : (
                                <img src={fullscreenIcon} alt="" className="w-5 h-5" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
