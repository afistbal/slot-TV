import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { FORYOU_MAX_VISIBLE_TAGS } from '../foryouConstants';

import { FeedPlayerBottomInfo } from '@/components/feed';

type Props = {
    data: IPlayerData;
    episode: IPlayerEpisode | undefined;
    /** For You：集数展示在简介行（Ep.N | …），不在顶栏 */
    episodeNo?: number;
    onOpenIntroduction: () => void;
};

/** For You 业务页薄封装，内部走通用 `FeedPlayerBottomInfo` */
export function ForYouPlayerBottomInfo({ data, episode, episodeNo, onOpenIntroduction }: Props) {
    return (
        <FeedPlayerBottomInfo
            title={data.info.title}
            introduction={data.info.introduction}
            episodeNo={episodeNo ?? episode?.episode}
            tags={data.tags}
            maxTags={FORYOU_MAX_VISIBLE_TAGS}
            onOpenIntroduction={onOpenIntroduction}
        />
    );
}
