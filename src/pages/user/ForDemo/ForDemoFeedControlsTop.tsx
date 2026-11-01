import { FeedPlayerBottomInfo, type FeedPlayerBottomInfoTag } from '@/components/feed';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/components/foryou-feed/foryouConstants';
import { VideoPlayerQuickActions } from '@/components/video-player/VideoPlayerQuickActions';

type ForDemoFeedControlsTopProps = {
    title: string;
    introduction?: string | null;
    episodeNo?: number | null;
    tags?: FeedPlayerBottomInfoTag[];
    feedEpisodeTotal: number;
    onOpenIntroduction: () => void;
    onWatchFullSeries: () => void;
    onWatchFullSeriesIntent?: () => void;
    onShare: () => void;
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
    onWatchFullSeriesIntent,
    onShare,
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
            <VideoPlayerQuickActions
                episodeNo={episodeNo ?? 1}
                episodeCount={feedEpisodeTotal}
                onEpisodes={onWatchFullSeries}
                onEpisodesIntent={onWatchFullSeriesIntent}
                onShare={onShare}
            />
        </>
    );
}
