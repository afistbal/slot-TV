import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import type Player from 'xgplayer';

import iconPlay1 from '@/assets/video/icon_play1@2x.webp';
import { useVideoPlayerDesktop } from '@/hooks/useVideoPlayerDesktop';
import { cn } from '@/lib/utils';

import { isPlayerPaused, togglePlayerPlay } from './playerControlsApi';

type FeedCenterPlayButtonProps = {
    player: Player | null;
    /** 仅当前激活条展示 */
    visible: boolean;
};

/** 对标 ForYouPlayer `showForyouCenterPlayIcon`：暂停时常显播放三角，点击视频区恢复播放 */
export function FeedCenterPlayButton({ player, visible }: FeedCenterPlayButtonProps) {
    const isDesktop = useVideoPlayerDesktop();
    const [showPaused, setShowPaused] = useState(false);

    useEffect(() => {
        let showTimer: number | null = null;

        const clearShowTimer = () => {
            if (showTimer == null) return;
            window.clearTimeout(showTimer);
            showTimer = null;
        };

        const applyPaused = (nextPaused: boolean) => {
            clearShowTimer();
            if (!nextPaused) {
                setShowPaused(false);
                return;
            }
            showTimer = window.setTimeout(() => {
                setShowPaused(true);
                showTimer = null;
            }, 280);
        };

        if (!player || !visible) {
            setShowPaused(false);
            return clearShowTimer;
        }

        const sync = () => applyPaused(isPlayerPaused(player));
        const events = ['play', 'pause', 'ended', 'loadedmetadata'] as const;
        events.forEach((ev) => player.on(ev, sync));
        sync();

        return () => {
            clearShowTimer();
            events.forEach((ev) => player.off(ev, sync));
        };
    }, [player, visible]);

    const onClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            void togglePlayerPlay(player);
        },
        [player],
    );

    if (!visible || !player || !showPaused) {
        return null;
    }

    return (
        <button
            type="button"
            className={cn(
                'video-player-center-play absolute inset-0 z-[8] m-auto flex h-20 w-20 items-center justify-center border-0 bg-transparent p-0 pointer-events-auto',
                isDesktop && 'video-player-center-play--pc-decor',
            )}
            onClick={onClick}
            aria-label="Play"
            tabIndex={-1}
        >
            <img src={iconPlay1} alt="" className="h-16 w-16 object-contain" aria-hidden />
        </button>
    );
}
