import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import Forward from '@/components/Forward';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { getTagDisplayText } from '../videoPlayerUtils';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';
import { useMovieTagLabelsReady } from '@/lib/movieTagLabels';

type Props = {
    data: IPlayerData;
    episode: IPlayerEpisode | undefined;
    onOpenIntroduction: () => void;
};

export function VideoPlayerBottomInfo({ data, episode, onOpenIntroduction }: Props) {
    useMovieTagLabelsReady();
    return (
        <div
            className="video-player-h5-info"
            onClick={(e) => {
                e.stopPropagation();
                onOpenIntroduction();
            }}
        >
            <div className="video-player-h5-title-row">
                <span className="video-player-h5-title">{data.info.title}</span>
                <Forward className="video-player-h5-title-chevron w-4 h-4 shrink-0" />
            </div>
            <div className="video-player-h5-desc">
                {data.info.introduction ? (
                    <>
                        <span className="video-player-h5-ep">
                            <FormattedMessage
                                id="wallet_episode_short"
                                values={{ n: episode?.episode ?? '..' }}
                            />
                        </span>
                        <span className="video-player-h5-desc-sep" aria-hidden="true">
                            {' | '}
                        </span>
                        <span className="video-player-h5-desc-text">{data.info.introduction}</span>
                    </>
                ) : (
                    <span className="video-player-h5-desc-text">
                        <FormattedMessage id="no_introduction_available" />
                    </span>
                )}
            </div>
            {data.tags.length > 0 && (
                <div
                    className="video-player-h5-tags"
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {data.tags.map((v) => (
                        <Link
                            key={v.name}
                            to={videoIntroTagSearchPath(v)}
                            className="video-player-h5-tag"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {getTagDisplayText(v)}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
