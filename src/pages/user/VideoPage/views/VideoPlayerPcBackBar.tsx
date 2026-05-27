import { ChevronLeft } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { cn } from '@/lib/utils';

export type VideoPlayerPcBackBarProps = {
    episodeNo?: number;
    onBack: () => void;
    className?: string;
};

const PC_TOPNAV_LOGO_SELECTOR = '.video-vertical-pc-topnav .reelshort-topnav__brand-logo';

/** PC 左上返回：左缘与顶栏 Logo 图标对齐（设计图） */
export function VideoPlayerPcBackBar({ episodeNo, onBack, className }: VideoPlayerPcBackBarProps) {
    const barRef = useRef<HTMLButtonElement>(null);

    useLayoutEffect(() => {
        const bar = barRef.current;
        const shell = bar?.closest<HTMLElement>('.video-player-pc-shell');
        const logo = document.querySelector<HTMLElement>(PC_TOPNAV_LOGO_SELECTOR);
        if (!bar || !shell || !logo) {
            return;
        }

        const sync = () => {
            const shellRect = shell.getBoundingClientRect();
            const logoRect = logo.getBoundingClientRect();
            bar.style.left = `${Math.max(0, Math.round(logoRect.left - shellRect.left))}px`;
        };

        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(shell);
        ro.observe(logo);
        window.addEventListener('resize', sync);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', sync);
            bar.style.left = '';
        };
    }, []);

    return (
        <button
            ref={barRef}
            type="button"
            className={cn('video-player-pc-back-bar', className)}
            onClick={onBack}
            aria-label="Back"
        >
            <ChevronLeft className="video-player-pc-back-bar__chevron" aria-hidden strokeWidth={2} />
            {episodeNo != null ? (
                <span className="video-player-pc-back-bar__ep">
                    <FormattedMessage id="wallet_episode_short" values={{ n: episodeNo }} />
                </span>
            ) : null}
        </button>
    );
}
