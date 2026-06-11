import { FeedPlayerBottomInfo, type FeedPlayerBottomInfoTag } from '@/components/feed';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/components/foryou-feed/foryouConstants';
import { ForYouWatchFullSeriesButton } from '@/components/foryou-feed/views/ForYouWatchFullSeriesButton';

type ForDemoFeedControlsTopProps = {
    title: string;
    introduction?: string | null;
    episodeNo?: number | null;
    tags?: FeedPlayerBottomInfoTag[];
    feedEpisodeTotal: number;
    onOpenIntroduction: () => void;
    onWatchFullSeries: () => void;
};

/** for-demo 底栏 info + Watch Full，作为 `controlsTopContent` 与进度条/工具栏同一容器 */
export function ForDemoFeedControlsTop({
    title,
    introduction,
    episodeNo,
    tags,
    feedEpisodeTotal,
    onOpenIntroduction,
    onWatchFullSeries,
}: ForDemoFeedControlsTopProps) {
    return (
        <>
            <FeedPlayerBottomInfo
                title={title}
                introduction={introduction}
                episodeNo={episodeNo}
                tags={tags}
                maxTags={FORYOU_MAX_VISIBLE_TAGS}
                onOpenIntroduction={onOpenIntroduction}
            />
            <ForYouWatchFullSeriesButton
                feedEpisodeTotal={feedEpisodeTotal}
                onClick={onWatchFullSeries}
            />
        </>
    );
}
