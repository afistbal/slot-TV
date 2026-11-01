import { ArrowUpRight, ListVideo } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    variant?: 'inline' | 'h5' | 'pc';
    episodeNo: number;
    episodeCount: number;
    onEpisodes: () => void;
    onEpisodesIntent?: () => void;
    onShare: () => void;
};

export function VideoPlayerQuickActions({ variant = 'inline', episodeNo, episodeCount, onEpisodes, onEpisodesIntent, onShare }: Props) {
    return <div className={cn('video-player-quick-actions', `video-player-quick-actions--${variant}`)} data-vertical-swipe-ignore>
        <button
            type="button"
            onPointerDown={onEpisodesIntent}
            onTouchStart={onEpisodesIntent}
            onMouseEnter={onEpisodesIntent}
            onFocus={onEpisodesIntent}
            onClick={(event) => { event.stopPropagation(); onEpisodes(); }}
        >
            <ListVideo />
            <span>选集 · EP.{String(episodeNo).padStart(2, '0')}/{episodeCount}</span>
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onShare(); }}>
            <ArrowUpRight />
            <span>分享赚金币</span>
        </button>
    </div>;
}
