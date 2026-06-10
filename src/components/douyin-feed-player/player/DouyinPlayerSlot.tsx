import { useCallback, useState, type MouseEvent } from 'react';
import type Player from 'xgplayer';

import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';

import { togglePlayerPlay } from '../controls/playerControlsApi';
import { getFeedItemDataAttrs } from '../feed/buildPlayerSlots';
import type { PlaybackMode, PlayerSlotState } from '../types';
import { useDouyinPlayerSlot } from './useDouyinPlayerSlot';

import './douyin-player-slot.scss';

type DouyinPlayerSlotProps = {
    slot: PlayerSlotState;
    hasPreload?: boolean;
    onEnded?: () => void;
    onPlayerChange?: (index: number, player: Player | null) => void;
    onPlaybackModeChange?: (index: number, mode: PlaybackMode) => void;
    onStall?: (index: number, reason: string) => void;
};

export function DouyinPlayerSlot({
    slot,
    hasPreload,
    onEnded,
    onPlayerChange,
    onPlaybackModeChange,
    onStall,
}: DouyinPlayerSlotProps) {
    const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
    const isDesktop = useMinWidth768();
    const attrs = getFeedItemDataAttrs(slot.isActive);

    /** 对标 ForYouPlayer：PC 9:16 舞台；H5 铺满 slide */
    const stageClassName = cn(
        'douyin-player-slot__stage relative overflow-hidden bg-black',
        isDesktop ? 'h-full max-h-full w-auto max-w-full aspect-[9/16]' : 'h-full w-full',
    );

    const handlePlayerChange = useCallback(
        (player: Player | null) => {
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

    const onTapVideo = useCallback(
        (event: MouseEvent) => {
            if ((event.target as HTMLElement).closest('.douyin-player-controls')) return;
            event.preventDefault();
            event.stopPropagation();
            const player = handleRef.current?.player ?? null;
            void togglePlayerPlay(player);
        },
        [handleRef],
    );

    return (
        <div
            className="douyin-player-slot"
            data-index={slot.index}
            data-active={slot.isActive ? 'true' : 'false'}
            {...attrs}
        >
            {slot.shouldInitPlayer ? (
                <div className={stageClassName}>
                    <div
                        ref={setMountEl}
                        className="douyin-player-slot__mount"
                        onClickCapture={onTapVideo}
                        role="presentation"
                    />
                </div>
            ) : (
                <div className={cn(stageClassName, 'douyin-player-slot__placeholder')} aria-hidden />
            )}
        </div>
    );
}
