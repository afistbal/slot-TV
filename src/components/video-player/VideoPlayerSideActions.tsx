import type { MouseEvent, ReactNode } from 'react';
import { Bookmark, Crown, Flame, LayoutGrid, Star, ThumbsUp } from 'lucide-react';
import { FormattedMessage } from 'react-intl';

import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import { cn } from '@/lib/utils';
import { formatFavoriteCountK } from '@/components/video-player/videoPlayerUtils';

function SideActionItem({
    icon,
    label,
    onClick,
    labelClassName = 'text-white',
}: {
    icon: ReactNode;
    label: ReactNode;
    onClick: (event: MouseEvent) => void;
    labelClassName?: string;
}) {
    return (
        <button
            type="button"
            className="group flex min-w-10 cursor-pointer flex-col items-center gap-0.5 border-0 bg-transparent p-0 text-white outline-none transition-transform duration-150 hover:scale-105 active:scale-90"
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick(event);
            }}
        >
            <span className="grid h-9 w-9 place-items-center">
                {icon}
            </span>
            <span className={cn('h-4 text-center text-[11px] font-medium leading-4', labelClassName)}>{label}</span>
        </button>
    );
}

export type VideoPlayerSideActionsProps = {
    variant: 'h5' | 'pc';
    showVip?: boolean;
    favorite?: boolean;
    favoriteCount?: number;
    liked?: boolean;
    likeCount?: number;
    ratingScore?: number;
    ambient?: boolean;
    showEpisodeList?: boolean;
    onVipClick?: (event: MouseEvent) => void;
    onFavoriteClick?: (event: MouseEvent) => void;
    onLikeClick?: (event: MouseEvent) => void;
    onRatingClick?: (event: MouseEvent) => void;
    onAmbientClick?: (event: MouseEvent) => void;
    onEpisodeListClick?: (event: MouseEvent) => void;
    onShareClick?: (event: MouseEvent) => void;
    className?: string;
};

export function VideoPlayerSideActions({
    variant,
    showVip = false,
    favorite = false,
    favoriteCount = 0,
    liked = false,
    likeCount = 0,
    ratingScore = 0,
    ambient = false,
    showEpisodeList = false,
    onVipClick,
    onFavoriteClick,
    onLikeClick,
    onRatingClick,
    onAmbientClick,
    onEpisodeListClick,
    onShareClick,
    className,
}: VideoPlayerSideActionsProps) {
    const showVipAction = showVip && onVipClick;
    const showShareAction = onShareClick;

    return (
        <div
            className={cn(
                variant === 'h5'
                    ? 'video-player-h5-side-actions absolute right-4 flex flex-col gap-4 pointer-events-auto'
                    : 'video-player-pc-side-actions flex shrink-0 flex-col gap-4',
                className,
            )}
            data-vertical-swipe-ignore
        >
            {showVipAction ? (
                <SideActionItem
                    icon={<Crown className="h-8 w-8 fill-[#ffd000] text-[#ffd000]" aria-hidden />}
                    label={<FormattedMessage id="shopping_vip_fab_label" />}
                    onClick={onVipClick}
                    labelClassName="text-[#ffd000]"
                />
            ) : null}
            {onLikeClick ? (
                <SideActionItem
                    icon={
                        <ThumbsUp
                            className={cn(
                                'h-7 w-7 fill-transparent text-white stroke-[2.15] transition-all duration-200',
                                liked && 'fill-[#ffd54a] text-[#ffd54a]',
                            )}
                            aria-hidden
                        />
                    }
                    label={likeCount > 0 ? formatFavoriteCountK(likeCount) : <FormattedMessage id="video_like" defaultMessage="点赞" />}
                    onClick={onLikeClick}
                    labelClassName={liked ? 'text-[#ffd000]' : 'text-white'}
                />
            ) : null}
            {onFavoriteClick ? (
                <SideActionItem
                    icon={
                        <Bookmark
                            className={cn(
                                'h-7 w-7 fill-transparent text-white stroke-[2.15] transition-all duration-200',
                                favorite && 'fill-[#ffd54a] text-[#ffd54a]',
                            )}
                            aria-hidden
                        />
                    }
                    label={formatFavoriteCountK(favoriteCount)}
                    onClick={onFavoriteClick}
                />
            ) : null}
            {onRatingClick ? (
                <SideActionItem
                    icon={
                        <Star
                            className={cn(
                                'h-7 w-7 fill-transparent text-white stroke-[2.15] transition-all duration-200',
                                ratingScore > 0 && 'fill-[#ffd54a] text-[#ffd54a]',
                            )}
                            aria-hidden
                        />
                    }
                    label={ratingScore > 0 ? `${ratingScore}分` : <FormattedMessage id="video_rate" defaultMessage="打分" />}
                    onClick={onRatingClick}
                    labelClassName={ratingScore > 0 ? 'text-[#ffd000]' : 'text-white'}
                />
            ) : null}
            {onAmbientClick ? (
                <SideActionItem
                    icon={
                        <Flame
                            className={cn(
                                'h-8 w-8 text-white transition-colors',
                                ambient && 'fill-[var(--rs-brand)] text-[var(--rs-brand)]',
                            )}
                            aria-hidden
                        />
                    }
                    label={<FormattedMessage id="video_ambient" defaultMessage="氛围" />}
                    onClick={onAmbientClick}
                    labelClassName={ambient ? 'text-[var(--rs-brand)]' : 'text-white'}
                />
            ) : null}
            {showEpisodeList && onEpisodeListClick ? (
                <SideActionItem
                    icon={<LayoutGrid className="h-8 w-8 fill-white text-white" aria-hidden />}
                    label={<FormattedMessage id="episode_list" />}
                    onClick={onEpisodeListClick}
                />
            ) : null}
            {showShareAction ? (
                <SideActionItem
                    icon={<img src={shareEntryIcon} alt="" className="h-8 w-8" />}
                    label={<FormattedMessage id="share" />}
                    onClick={showShareAction}
                />
            ) : null}
        </div>
    );
}
