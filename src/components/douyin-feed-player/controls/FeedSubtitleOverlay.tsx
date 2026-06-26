import type Player from 'xgplayer';

import { cn } from '@/lib/utils';

import { useFeedSubtitle } from './useFeedSubtitle';

import './feed-subtitle-overlay.scss';

type FeedSubtitleOverlayProps = {
    player: Player | null;
    /** 已拼好的 VTT 绝对 URL；空则不渲染 */
    subtitleUrl: string;
    className?: string;
};

/** 在 video stage 内 absolute bottom，距播放器底 160px。 */
export function FeedSubtitleOverlay({ player, subtitleUrl, className }: FeedSubtitleOverlayProps) {
    const { text, ready, loading, error } = useFeedSubtitle(player, subtitleUrl);

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
            className={cn('feed-subtitle-overlay', className)}
            aria-live="polite"
            data-subtitle-ready={ready ? 'true' : loading ? 'pending' : 'false'}
        >
            <div className="feed-subtitle-overlay__text">{text}</div>
        </div>
    );
}
