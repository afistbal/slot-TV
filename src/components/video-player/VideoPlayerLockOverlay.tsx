import { Unlock } from 'lucide-react';
import { type MouseEvent } from 'react';
import { FormattedMessage } from 'react-intl';

import paidEpisodeLockIcon from '@/assets/images/7f47ede0-ef83-11f0-84ad-6b5693b490dc.png';
import { cn } from '@/lib/utils';

export type VideoPlayerLockOverlayProps = {
    onUnlock: () => void;
    className?: string;
    /** pc：图标+文案+按钮；h5：居中解锁按钮（对齐 /video） */
    variant?: 'pc' | 'h5';
};

function handleUnlockClick(event: MouseEvent, onUnlock: () => void) {
    event.preventDefault();
    event.stopPropagation();
    onUnlock();
}

export function VideoPlayerLockOverlay({
    onUnlock,
    className,
    variant = 'pc',
}: VideoPlayerLockOverlayProps) {
    if (variant === 'h5') {
        return (
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 flex items-center justify-center',
                    className,
                )}
            >
                <div
                    className="pointer-events-auto flex cursor-pointer items-center justify-center gap-2 rounded-full bg-linear-to-r from-amber-400 to-red-400 p-4 px-12 text-xl font-bold text-white"
                    onClick={(event) => handleUnlockClick(event, onUnlock)}
                >
                    <Unlock className="h-5 w-5 stroke-4" />
                    <div>
                        <FormattedMessage id="unlock_now" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'video-player-pc-lock-overlay absolute inset-0',
                className,
            )}
        >
            <img src={paidEpisodeLockIcon} alt="" className="video-player-pc-lock-overlay__icon" />
            <p className="video-player-pc-lock-overlay__text">
                <FormattedMessage id="pay_unlock_toast_locked_episode" />
            </p>
            <div
                className="video-player-pc-lock-overlay__button"
                onClick={(event) => handleUnlockClick(event, onUnlock)}
            >
                <Unlock className="video-player-pc-lock-overlay__buttonIcon" />
                <div>
                    <FormattedMessage id="unlock_now" />
                </div>
            </div>
        </div>
    );
}
