import { useCallback, useEffect, useRef, useState, type MouseEvent, type MutableRefObject } from 'react';
import type Player from 'xgplayer';

import mountLoadingGif from '@/assets/icons/loading.gif';
import { useVideoPlayerDesktop } from '@/hooks/useVideoPlayerDesktop';
import { cn } from '@/lib/utils';

import { FeedCenterPlayButton } from '../controls/FeedCenterPlayButton';
import { FeedSubtitleOverlay } from '../controls/FeedSubtitleOverlay';
import { togglePlayerPlay } from '../controls/playerControlsApi';
import { getFeedItemDataAttrs } from '../feed/buildPlayerSlots';
import type { PlaybackMode, PlayerSlotState } from '../types';
import { useDouyinPlayerSlot } from './useDouyinPlayerSlot';
import { bindLongPressSpeed } from './bindLongPressSpeed';

import './douyin-player-slot.scss';

type DouyinPlayerSlotProps = {
    slot: PlayerSlotState;
    /** VTT 绝对 URL；空字符串表示本条无字幕 */
    subtitleUrl?: string;
    hasPreload?: boolean;
    onEnded?: () => void;
    onPlayerChange?: (index: number, player: Player | null) => void;
    onPlaybackModeChange?: (index: number, mode: PlaybackMode) => void;
    onStall?: (index: number, reason: string) => void;
    onFullscreenVideoTap?: (target?: EventTarget | null) => boolean;
    onToggleFullscreen?: () => Promise<boolean>;
    isFullscreenUi?: boolean;
    chromeTapSuppressRef?: MutableRefObject<boolean>;
    infoBumpRef?: MutableRefObject<(() => void) | null>;
};

export function DouyinPlayerSlot({
    slot,
    subtitleUrl = '',
    hasPreload,
    onEnded,
    onPlayerChange,
    onPlaybackModeChange,
    onStall,
    onFullscreenVideoTap,
    onToggleFullscreen,
    isFullscreenUi = false,
    chromeTapSuppressRef,
    infoBumpRef,
}: DouyinPlayerSlotProps) {
    const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
    const [slotPlayer, setSlotPlayer] = useState<Player | null>(null);
    const [mountLoadingVisible, setMountLoadingVisible] = useState(true);
    const [isLongPressSpeeding, setIsLongPressSpeeding] = useState(false);
    const [landscapeFullscreenTop, setLandscapeFullscreenTop] = useState<number | null>(null);
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const suppressTapUntilRef = useRef(0);
    const isDesktop = useVideoPlayerDesktop();
    const attrs = getFeedItemDataAttrs(slot.isActive);

    /** PC 9:16 由外层 video-player-pc-shell 舞台约束；H5 NetShort 式 9:16 居中露黑边 */
    const stageClassName = cn(
        'douyin-player-slot__stage relative overflow-hidden bg-black',
        isDesktop ? 'h-full w-full' : 'douyin-player-slot__stage--aspect',
    );

    const handlePlayerChange = useCallback(
        (player: Player | null) => {
            setSlotPlayer(player);
            onPlayerChange?.(slot.index, player);
        },
        [onPlayerChange, slot.index],
    );

    const handleRef = useDouyinPlayerSlot({
        mountEl: slot.shouldInitPlayer ? mountEl : null,
        url: slot.item.url,
        isActive: slot.isActive,
        shouldInit: slot.shouldInitPlayer,
        hasPreload,
        slotIndex: slot.index,
        onPlayerChange: handlePlayerChange,
        onPlaybackModeChange,
        onStall,
        onEnded,
    });

    const isControlsTarget = (target: EventTarget | null) =>
        target instanceof Element &&
        Boolean(
            target.closest(
                '.douyin-player-controls, .douyin-player-slot__landscape-fullscreen',
            ),
        );

    const onTapVideo = useCallback(
        (event: MouseEvent) => {
            if (Date.now() < suppressTapUntilRef.current) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (chromeTapSuppressRef?.current) return;
            if (isControlsTarget(event.target)) return;
            event.preventDefault();
            event.stopPropagation();
            if (onFullscreenVideoTap?.(event.target)) return;
            infoBumpRef?.current?.();
            const player = handleRef.current?.player ?? null;
            void togglePlayerPlay(player);
        },
        [chromeTapSuppressRef, handleRef, infoBumpRef, onFullscreenVideoTap],
    );

    useEffect(() => {
        const surface = surfaceRef.current;
        const video = slotPlayer?.video as HTMLVideoElement | undefined;
        if (!surface || !video || !slot.isActive) return;
        return bindLongPressSpeed(surface, video, (active) => {
            suppressTapUntilRef.current = active ? Infinity : Date.now() + 500;
            setIsLongPressSpeeding(active);
        });
    }, [slot.isActive, slot.item.url, slotPlayer]);

    const showSubtitle = slot.isActive && Boolean(subtitleUrl.trim());

    useEffect(() => {
        setMountLoadingVisible(true);
    }, [slot.item.url]);

    useEffect(() => {
        if (slot.isActive) {
            setMountLoadingVisible(true);
        }
    }, [slot.isActive]);

    useEffect(() => {
        if (!slotPlayer) {
            setMountLoadingVisible(true);
            return;
        }

        const player = slotPlayer;
        const syncMountLoading = () => {
            const video = player.video as HTMLVideoElement | undefined;
            if (!video) {
                setMountLoadingVisible(slot.isActive);
                return;
            }
            const canPlayForward = Boolean(
                video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA,
            );
            // 暂停（含有声自动播放被浏览器拒绝）时只显示播放按钮，不继续转 loading。
            setMountLoadingVisible(slot.isActive && !video.paused && !canPlayForward);
        };

        const events = [
            'loadstart',
            'loadedmetadata',
            'loadeddata',
            'canplay',
            'playing',
            'play',
            'timeupdate',
            'pause',
            'waiting',
            'stalled',
            'ended',
            'emptied',
        ] as const;
        events.forEach((eventName) => player.on(eventName, syncMountLoading));
        const video = player.video as HTMLVideoElement | undefined;
        events.forEach((eventName) => video?.addEventListener(eventName, syncMountLoading));
        syncMountLoading();

        return () => {
            events.forEach((eventName) => player.off(eventName, syncMountLoading));
            events.forEach((eventName) => video?.removeEventListener(eventName, syncMountLoading));
        };
    }, [slot.isActive, slot.item.url, slotPlayer]);

    useEffect(() => {
        if (!slotPlayer || !slot.isActive || !onToggleFullscreen || isDesktop) {
            setLandscapeFullscreenTop(null);
            return;
        }

        const video = slotPlayer.video as HTMLVideoElement | undefined;
        if (!video) {
            setLandscapeFullscreenTop(null);
            return;
        }

        const syncLandscapeButton = () => {
            const stage = video.closest('.douyin-player-slot__stage') as HTMLElement | null;
            const { videoWidth, videoHeight } = video;
            if (!stage || !videoWidth || !videoHeight || videoWidth <= videoHeight) {
                setLandscapeFullscreenTop(null);
                return;
            }

            const stageRect = stage.getBoundingClientRect();
            const mediaHeight = Math.min(
                stageRect.height,
                stageRect.width / (videoWidth / videoHeight),
            );
            const mediaBottom = (stageRect.height + mediaHeight) / 2;
            const slide = stage.closest('.douyin-feed-player__slide');
            const info = slide?.querySelector('.video-player-h5-info') as HTMLElement | null;
            const infoTop = info
                ? info.getBoundingClientRect().top - stageRect.top
                : stageRect.height;
            const desiredCenter = mediaBottom + 20;
            const maxCenterBeforeTitle = infoTop - 22;
            // hgdju keeps this chip immediately after the landscape picture and before
            // the title block. If the remaining gap is too small, keep it just inside
            // the picture instead of allowing it to cover the title.
            const buttonCenter =
                maxCenterBeforeTitle >= mediaBottom + 14
                    ? Math.min(desiredCenter, maxCenterBeforeTitle)
                    : mediaBottom - 22;
            setLandscapeFullscreenTop(Math.round(buttonCenter));
        };

        video.addEventListener('loadedmetadata', syncLandscapeButton);
        video.addEventListener('resize', syncLandscapeButton);
        const stage = video.closest('.douyin-player-slot__stage') as HTMLElement | null;
        const resizeObserver =
            typeof ResizeObserver !== 'undefined' && stage
                ? new ResizeObserver(syncLandscapeButton)
                : null;
        resizeObserver?.observe(stage!);
        syncLandscapeButton();

        return () => {
            video.removeEventListener('loadedmetadata', syncLandscapeButton);
            video.removeEventListener('resize', syncLandscapeButton);
            resizeObserver?.disconnect();
        };
    }, [isDesktop, onToggleFullscreen, slot.isActive, slot.item.url, slotPlayer]);

    return (
        <div
            ref={surfaceRef}
            className="douyin-player-slot"
            data-index={slot.index}
            data-active={slot.isActive ? 'true' : 'false'}
            {...attrs}
        >
            {slot.shouldInitPlayer ? (
                <div
                    className={stageClassName}
                    onClickCapture={onTapVideo}
                >
                    <div
                        ref={setMountEl}
                        className="douyin-player-slot__mount"
                        role="presentation"
                    />
                    {mountLoadingVisible ? (
                        <div className="douyin-player-slot__mount-loading" aria-hidden>
                            <img
                                className="douyin-player-slot__mount-loading-img"
                                src={mountLoadingGif}
                                alt=""
                                draggable={false}
                            />
                        </div>
                    ) : null}
                    <FeedCenterPlayButton player={slotPlayer} visible={slot.isActive} />
                    {isLongPressSpeeding ? (
                        <div className="douyin-player-slot__speeding" role="status" aria-live="polite">
                            <strong>2x</strong>&nbsp;快进中
                        </div>
                    ) : null}
                    {landscapeFullscreenTop !== null && !isFullscreenUi ? (
                        <button
                            type="button"
                            className="douyin-player-slot__landscape-fullscreen"
                            data-vertical-swipe-ignore
                            style={{ top: landscapeFullscreenTop }}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void onToggleFullscreen?.();
                            }}
                            aria-label="全屏播放"
                        >
                            全屏播放
                        </button>
                    ) : null}
                    {showSubtitle ? (
                        <FeedSubtitleOverlay player={slotPlayer} subtitleUrl={subtitleUrl} />
                    ) : null}
                </div>
            ) : (
                <div className={cn(stageClassName, 'douyin-player-slot__placeholder')} aria-hidden>
                    <div className="douyin-player-slot__mount-loading">
                        <img
                            className="douyin-player-slot__mount-loading-img"
                            src={mountLoadingGif}
                            alt=""
                            draggable={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
