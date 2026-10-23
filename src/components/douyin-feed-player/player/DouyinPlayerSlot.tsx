import { useCallback, useEffect, useRef, useState, type MouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
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
    chromeTapSuppressRef,
    infoBumpRef,
}: DouyinPlayerSlotProps) {
    const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
    const [slotPlayer, setSlotPlayer] = useState<Player | null>(null);
    const [mountLoadingVisible, setMountLoadingVisible] = useState(true);
    const [isLongPressSpeeding, setIsLongPressSpeeding] = useState(false);
    const longPressTimerRef = useRef<number | null>(null);
    const longPressStartRef = useRef({ x: 0, y: 0 });
    const previousRateRef = useRef(1);
    const longPressActiveRef = useRef(false);
    const suppressNextTapRef = useRef(false);
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
        target instanceof Element && Boolean(target.closest('.douyin-player-controls'));

    const onTapVideo = useCallback(
        (event: MouseEvent) => {
            if (suppressNextTapRef.current) {
                suppressNextTapRef.current = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (chromeTapSuppressRef?.current) return;
            event.preventDefault();
            event.stopPropagation();
            if (onFullscreenVideoTap?.(event.target)) return;
            if (isControlsTarget(event.target)) return;
            infoBumpRef?.current?.();
            const player = handleRef.current?.player ?? null;
            void togglePlayerPlay(player);
        },
        [chromeTapSuppressRef, handleRef, infoBumpRef, onFullscreenVideoTap],
    );

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const stopLongPressSpeed = useCallback(() => {
        clearLongPressTimer();
        const video = (handleRef.current?.player?.video ?? null) as HTMLVideoElement | null;
        if (longPressActiveRef.current && video) video.playbackRate = previousRateRef.current;
        if (longPressActiveRef.current) suppressNextTapRef.current = true;
        longPressActiveRef.current = false;
        setIsLongPressSpeeding(false);
    }, [clearLongPressTimer, handleRef]);

    const onLongPressPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!slot.isActive || event.button !== 0 || isControlsTarget(event.target)) return;
        clearLongPressTimer();
        longPressStartRef.current = { x: event.clientX, y: event.clientY };
        longPressTimerRef.current = window.setTimeout(() => {
            const video = (handleRef.current?.player?.video ?? null) as HTMLVideoElement | null;
            if (!video) return;
            previousRateRef.current = video.playbackRate || 1;
            video.playbackRate = 2;
            longPressActiveRef.current = true;
            suppressNextTapRef.current = true;
            setIsLongPressSpeeding(true);
        }, 450);
    }, [clearLongPressTimer, handleRef, slot.isActive]);

    const onLongPressPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const dx = event.clientX - longPressStartRef.current.x;
        const dy = event.clientY - longPressStartRef.current.y;
        if (!isLongPressSpeeding && Math.hypot(dx, dy) > 12) clearLongPressTimer();
    }, [clearLongPressTimer, isLongPressSpeeding]);

    useEffect(() => () => {
        clearLongPressTimer();
        const video = (handleRef.current?.player?.video ?? null) as HTMLVideoElement | null;
        if (video && longPressActiveRef.current) video.playbackRate = previousRateRef.current;
        longPressActiveRef.current = false;
    }, [clearLongPressTimer, handleRef]);

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

    return (
        <div
            className="douyin-player-slot"
            data-index={slot.index}
            data-active={slot.isActive ? 'true' : 'false'}
            {...attrs}
        >
            {slot.shouldInitPlayer ? (
                <div
                    className={stageClassName}
                    onClickCapture={onTapVideo}
                    onPointerDown={onLongPressPointerDown}
                    onPointerMove={onLongPressPointerMove}
                    onPointerUp={stopLongPressSpeed}
                    onPointerCancel={stopLongPressSpeed}
                    onPointerLeave={(event) => {
                        if (event.pointerType === 'mouse') stopLongPressSpeed();
                    }}
                    onContextMenu={(event) => {
                        if (isLongPressSpeeding) event.preventDefault();
                    }}
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
