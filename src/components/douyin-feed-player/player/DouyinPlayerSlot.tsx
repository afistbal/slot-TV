import { useCallback, useEffect, useState, type MouseEvent, type MutableRefObject } from 'react';
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
            const canPlayForward = Boolean(
                video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA,
            );
            setMountLoadingVisible(slot.isActive && !canPlayForward);
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
                <div className={stageClassName} onClickCapture={onTapVideo}>
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
