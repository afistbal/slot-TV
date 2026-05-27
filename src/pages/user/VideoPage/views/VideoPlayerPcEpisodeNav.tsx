import btnArrow1 from '@/assets/video/btn_arrow1.webp';
import btnArrow1Disabled from '@/assets/video/btn_arrow1_disabled.webp';
import btnArrow2 from '@/assets/video/btn_arrow2.webp';
import btnArrow2Disabled from '@/assets/video/btn_arrow2_disabled.webp';
import type { MouseEvent } from 'react';
import { useIntl } from 'react-intl';

export type VideoPlayerPcEpisodeNavProps = {
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: (ev: MouseEvent<HTMLButtonElement>) => void;
    onNext: (ev: MouseEvent<HTMLButtonElement>) => void;
};

/** PC 上下集：位于右侧 rail 最右列，抽屉在其左侧 */
export function VideoPlayerPcEpisodeNav({
    hasPrev,
    hasNext,
    onPrev,
    onNext,
}: VideoPlayerPcEpisodeNavProps) {
    const intl = useIntl();

    return (
        <nav
            className="video-player-pc-episode-nav"
            aria-label={intl.formatMessage({
                id: 'episode_list',
                defaultMessage: 'Episodes',
            })}
            data-vertical-swipe-ignore
        >
            <button
                type="button"
                className="video-player-pc-episode-nav__btn"
                disabled={!hasPrev}
                onClick={hasPrev ? onPrev : undefined}
            >
                <img
                    src={hasPrev ? btnArrow1 : btnArrow1Disabled}
                    alt=""
                    className="video-player-pc-episode-nav__icon"
                    draggable={false}
                />
            </button>
            <button
                type="button"
                className="video-player-pc-episode-nav__btn"
                disabled={!hasNext}
                onClick={hasNext ? onNext : undefined}
            >
                <img
                    src={hasNext ? btnArrow2 : btnArrow2Disabled}
                    alt=""
                    className="video-player-pc-episode-nav__icon"
                    draggable={false}
                />
            </button>
        </nav>
    );
}
