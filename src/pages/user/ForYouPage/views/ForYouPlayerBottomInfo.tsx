import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import Forward from '@/components/Forward';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { getTagDisplayText } from '@/pages/user/VideoPage/videoPlayerUtils';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';

type Props = {
    data: IPlayerData;
    episode: IPlayerEpisode | undefined;
    /** For You：集数展示在简介行（Ep.N | …），不在顶栏 */
    episodeNo?: number;
    onOpenIntroduction: () => void;
};

export function ForYouPlayerBottomInfo({ data, episode, episodeNo, onOpenIntroduction }: Props) {
    const epNum = episodeNo ?? episode?.episode;
    const epLabel = epNum != null && epNum > 0 ? epNum : null;

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
                {epLabel != null ? (
                    <>
                        <span className="video-player-h5-ep">
                            <FormattedMessage id="wallet_episode_short" values={{ n: epLabel }} />
                        </span>
                        <span className="video-player-h5-desc-sep" aria-hidden="true">
                            {' | '}
                        </span>
                    </>
                ) : null}
                <span className="video-player-h5-desc-text">
                    {data.info.introduction ? (
                        data.info.introduction
                    ) : (
                        <FormattedMessage id="no_introduction_available" />
                    )}
                </span>
            </div>
            {data.tags.length > 0 ? (
                <div className="video-player-h5-tags">
                    {data.tags.map((v) => (
                        <Link
                            key={v.unique_id}
                            to={videoIntroTagSearchPath(v)}
                            className="video-player-h5-tag"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {getTagDisplayText(v)}
                        </Link>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
