import { useEffect, useState } from 'react';
import type Player from 'xgplayer';

import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';

import '@/styles/video-vertical.scss';

import { useFeedSubtitle } from './useFeedSubtitle';

type FeedSubtitleOverlayProps = {
    player: Player | null;
    /** 已拼好的 VTT 绝对 URL；空则不渲染 */
    subtitleUrl: string;
    className?: string;
};

/**
 * 对标 ForYouPlayer 字幕层：在 video stage 内 absolute bottom，
 * PC `video-player-pc-subtitle-pad` / H5 `video-player-h5-subtitle-pad`。
 */
export function FeedSubtitleOverlay({ player, subtitleUrl, className }: FeedSubtitleOverlayProps) {
    const isDesktop = useMinWidth768();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { text, ready, loading, error } = useFeedSubtitle(player, subtitleUrl);

    useEffect(() => {
        const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
        sync();
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    const trimmed = subtitleUrl.trim();
    if (!trimmed) {
        return null;
    }

    if (import.meta.env.DEV && error) {
        console.error('[douyin-feed-player] subtitle unavailable for active item', trimmed, error);
    }

    if (!ready || !text) {
        return null;
    }

    return (
        <div
            className={cn(
                'video-player-root absolute bottom-0 left-0 right-0 z-[5] mx-auto flex w-10/12 flex-col items-center justify-end gap-1 text-center pointer-events-none',
                isFullscreen ? 'pb-12' : isDesktop ? 'video-player-pc-subtitle-pad' : 'video-player-h5-subtitle-pad',
                className,
            )}
            aria-live="polite"
            data-subtitle-ready={ready ? 'true' : loading ? 'pending' : 'false'}
        >
            <div className="video-player-subtitle-text text-white px-2 py-1 rounded-md text-2xl font-bold">
                {text}
            </div>
        </div>
    );
}
