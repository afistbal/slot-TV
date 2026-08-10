import type { MouseEvent, ReactNode } from 'react';
import { Crown, LayoutGrid, Star } from 'lucide-react';
import { FormattedMessage } from 'react-intl';

import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import { cn } from '@/lib/utils';
import { formatFavoriteCountK } from '@/components/video-player/videoPlayerUtils';
import { isTikTokPlatform } from '@/platform';

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
        <div
            className="flex cursor-pointer flex-col items-center gap-1"
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick(event);
            }}
        >
            {icon}
            <div className={cn('h-4 text-center text-xs leading-4', labelClassName)}>{label}</div>
        </div>
    );
}

export type VideoPlayerSideActionsProps = {
    variant: 'h5' | 'pc';
    showVip?: boolean;
    favorite?: boolean;
    favoriteCount?: number;
    showEpisodeList?: boolean;
    onVipClick?: (event: MouseEvent) => void;
    onFavoriteClick?: (event: MouseEvent) => void;
    onEpisodeListClick?: (event: MouseEvent) => void;
    onShareClick?: (event: MouseEvent) => void;
    className?: string;
};

export function VideoPlayerSideActions({
    variant,
    showVip = false,
    favorite = false,
    favoriteCount = 0,
    showEpisodeList = false,
    onVipClick,
    onFavoriteClick,
    onEpisodeListClick,
    onShareClick,
    className,
}: VideoPlayerSideActionsProps) {
    const isTikTok = isTikTokPlatform();
    const showVipAction = !isTikTok && showVip && onVipClick;
    const showShareAction = !isTikTok && onShareClick;

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
            {onFavoriteClick ? (
                <SideActionItem
                    icon={
                        <Star
                            className={cn(
                                'h-8 w-8 fill-white text-white',
                                favorite && 'fill-[#ffd000] stroke-[#ffd000]',
                            )}
                            aria-hidden
                        />
                    }
                    label={formatFavoriteCountK(favoriteCount)}
                    onClick={onFavoriteClick}
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
