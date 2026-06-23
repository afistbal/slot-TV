import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import type Player from 'xgplayer';

import iconPlay1 from '@/assets/video/icon_play1@2x.webp';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';

import { isPlayerPaused, togglePlayerPlay } from './playerControlsApi';

type FeedCenterPlayButtonProps = {
    player: Player | null;
    /** 仅当前激活条展示 */
    visible: boolean;
};

/** 对标 ForYouPlayer `showForyouCenterPlayIcon`：暂停时常显播放三角，点击视频区恢复播放 */
export function FeedCenterPlayButton({ player, visible }: FeedCenterPlayButtonProps) {
    const isDesktop = useMinWidth768();
    const [paused, setPaused] = useState(true);

    useEffect(() => {
        if (!player || !visible) {
            setPaused(true);
            return;
        }

        const sync = () => setPaused(isPlayerPaused(player));
        const events = ['play', 'pause', 'ended', 'loadedmetadata'] as const;
        events.forEach((ev) => player.on(ev, sync));
        sync();

        return () => {
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

    if (!visible || !player || !paused) {
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
