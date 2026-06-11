import { ChevronLeft } from 'lucide-react';
import { type MouseEvent, type TouchEvent } from 'react';
import { FormattedMessage } from 'react-intl';

import { cn } from '@/lib/utils';

export type VideoPlayerH5BackBarProps = {
    episodeNo?: number;
    onBack: () => void;
    className?: string;
};

function stopBubble(event: MouseEvent | TouchEvent) {
    event.stopPropagation();
}

/** H5 ???? + Ep????/video??*/
export function VideoPlayerH5BackBar({ episodeNo, onBack, className }: VideoPlayerH5BackBarProps) {
    return (
        <div
            className={cn(
                'video-player-h5-topbar absolute top-0 left-0 right-0 w-full transition-opacity ease-linear',
                className,
            )}
            onClick={stopBubble}
            onTouchStart={stopBubble}
        >
            <div
                onClick={onBack}
                className="video-player-h5-topbar-back flex shrink-0 items-center justify-center text-white"
            >
                <ChevronLeft className="h-5 w-5" aria-hidden />
            </div>
            {episodeNo != null ? (
                <div className="video-player-h5-topbar-ep shrink-0 font-bold text-white">
                    <FormattedMessage id="wallet_episode_short" values={{ n: episodeNo }} />
                </div>
            ) : null}
        </div>
    );
}
