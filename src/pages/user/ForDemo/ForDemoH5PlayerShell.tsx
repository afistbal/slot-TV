import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router';

import {
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
    DouyinFeedPlayer,
} from '@/components/douyin-feed-player';
import {
    VideoPlayerH5ColdUnmuteOverlay,
    VideoPlayerSideActions,
    useFeedPlayerColdUnmuteVisible,
    useFeedPlayerTapToUnmute,
} from '@/components/video-player';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useUserStore } from '@/stores/user';
import { buildPlayerDataFromFeedItem, buildEpisodeFromFeedItem } from '@/pages/user/ForDemo/lib/foryouFeedUtils';
import { navigateFromForDemoWatchFull } from '@/pages/user/ForDemo/lib/foryouNavigateToVideo';
import {
    ForYouPlayerEpisodeSpeedIntroDrawers,
    ForYouPlayerH5CommerceDrawers,
    useForYouPlayerShare,
} from '@/components/foryou-feed/forYouPlayerOverlays';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/components/foryou-feed/foryouConstants';
import { resolveVideoPosterUrl } from '@/components/video-player/videoPlayerShareUrl';
import { useReportEpProgressAt5s } from '@/hooks/useReportEpProgressAt5s';
import { cn } from '@/lib/utils';
import type { IForYouFeedItem } from '@/types/foryouFeed';

import { ForDemoFeedBackTopbar } from './ForDemoFeedBackTopbar';
import { foryouFeedItemKey } from './lib/foryouFeedMerge';
import { ForDemoFeedControlsTop } from './ForDemoFeedControlsTop';
import { scrollForDemoFeedToIndex } from './forDemoFeedScroll';

type ForDemoH5PlayerShellProps = {
    staticBase: string;
    feedItem: IForYouFeedItem;
    playerItems: DouyinFeedVideoItem[];
    activeIndex: number;
    hasNext: boolean;
    hasMore: boolean;
    listLength: number;
    fullscreenTargetRef: RefObject<HTMLElement | null>;
    onFullscreenUiChange?: (active: boolean) => void;
    onIndexChange: (index: number, direction?: FeedNavigateDirection) => void;
    onLoadMore: () => void;
};

export function ForDemoH5PlayerShell({
    staticBase,
    feedItem,
    playerItems,
    activeIndex,
    hasNext,
    hasMore,
    listLength,
    fullscreenTargetRef,
    onFullscreenUiChange,
    onIndexChange,
    onLoadMore,
}: ForDemoH5PlayerShellProps) {
    const navigate = useNavigate();
    const userStore = useUserStore();
    const data = buildPlayerDataFromFeedItem(feedItem);
    const episode = buildEpisodeFromFeedItem(feedItem);
    const episodeNo = feedItem.episode ?? 1;
    const feedEpisodeTotal = feedItem.episodes ?? 0;
    const prevListLengthRef = useRef(listLength);

    const [favorite, setFavorite] = useState(
        feedItem.is_favor === true || feedItem.is_favorite === 1,
    );
    const [vip, setVip] = useState(false);
    const [introductionOpen, setIntroductionOpen] = useState(false);
    const [isFullscreenUi, setIsFullscreenUi] = useState(false);
    const episodeRef = useRef<HTMLDivElement>(null);

    const handleFullscreenUiChange = useCallback(
        (active: boolean) => {
            setIsFullscreenUi(active);
            onFullscreenUiChange?.(active);
        },
        [onFullscreenUiChange],
    );

    const {
        shareOpen,
        setShareOpen,
        shareEmbedCode,
        setShareEmbedCode,
        shareShowControls,
        setShareShowControls,
        handleShareAction,
        handleCopyEmbedCode,
    } = useForYouPlayerShare(data, staticBase, episodeNo);

    const shareCardPosterUrl = resolveVideoPosterUrl(staticBase, data.info, data.info.id);

    useEffect(() => {
        setFavorite(feedItem.is_favor === true || feedItem.is_favorite === 1);
    }, [feedItem.ep_id, feedItem.is_favor, feedItem.is_favorite]);

    useEffect(() => {
        if (listLength <= prevListLengthRef.current) {
            prevListLengthRef.current = listLength;
            return;
        }
        if (activeIndex === prevListLengthRef.current - 1) {
            requestAnimationFrame(() => {
                scrollForDemoFeedToIndex(activeIndex + 1);
            });
        }
        prevListLengthRef.current = listLength;
    }, [activeIndex, listLength]);

    const handleToggleFavorite = useCallback(() => {
        if (!skipRemoteApi) {
            void api('movie/favorite', {
                method: 'post',
                data: { id: data.info.id },
                loading: false,
            });
        }
        setFavorite((prev) => !prev);
    }, [data.info.id]);

    const handleToggleVip = useCallback(() => {
        if (userStore.signed && userStore.isVIP()) {
            return;
        }
        setVip((open) => !open);
    }, [userStore]);

    const handleFeedNext = useCallback(() => {
        if (activeIndex < playerItems.length - 1) {
            scrollForDemoFeedToIndex(activeIndex + 1);
            return;
        }
        if (hasMore) {
            onLoadMore();
        }
    }, [activeIndex, hasMore, onLoadMore, playerItems.length]);

    const handleWatchFullSeries = useCallback(() => {
        navigateFromForDemoWatchFull(navigate, feedItem, activeIndex);
    }, [activeIndex, feedItem, navigate]);

    const coldUnmuteVisible = useFeedPlayerColdUnmuteVisible(activeIndex);
    const handleTapToUnmute = useFeedPlayerTapToUnmute();

    useReportEpProgressAt5s({
        movieId: feedItem.id,
        epId: feedItem.ep_id,
        epNo: episodeNo,
        playerItemId: foryouFeedItemKey(feedItem),
    });

    return (
        <div className="for-demo-h5-shell relative h-full w-full">
            <DouyinFeedPlayer
                className="for-demo-h5-player h-full w-full"
                items={playerItems}
                mediaBaseUrl={staticBase}
                preloadNext
                fullscreenTargetRef={fullscreenTargetRef}
                onFullscreenUiChange={handleFullscreenUiChange}
                onIndexChange={onIndexChange}
                showNextEpisode={hasNext}
                onNextEpisode={handleFeedNext}
                fixedPlaybackSpeed
                controlsTopContent={
                    <ForDemoFeedControlsTop
                        title={data.info.title}
                        introduction={data.info.introduction}
                        episodeNo={episodeNo}
                        tags={data.tags}
                        feedEpisodeTotal={feedEpisodeTotal}
                        onOpenIntroduction={() => setIntroductionOpen(true)}
                        onWatchFullSeries={handleWatchFullSeries}
                    />
                }
            />
            <VideoPlayerH5ColdUnmuteOverlay
                visible={coldUnmuteVisible}
                onTapToUnmute={handleTapToUnmute}
            />
            <div
                className={cn(
                    'for-demo-h5-chrome pointer-events-none absolute inset-0 z-10',
                    isFullscreenUi && 'hidden',
                )}
            >
                <ForDemoFeedBackTopbar />
                <VideoPlayerSideActions
                    variant="h5"
                    showVip={!userStore.isVIP()}
                    favorite={favorite}
                    favoriteCount={data.info.favorite}
                    onVipClick={handleToggleVip}
                    onFavoriteClick={handleToggleFavorite}
                    onShareClick={() => setShareOpen(true)}
                />
            </div>
            <ForYouPlayerH5CommerceDrawers
                vip={vip}
                onVipOpenChange={setVip}
                onVipEmbedClose={() => setVip(false)}
                shareOpen={shareOpen}
                onShareOpenChange={setShareOpen}
                shareEmbedCode={shareEmbedCode}
                shareShowControls={shareShowControls}
                onToggleShareShowControls={() => setShareShowControls((v) => !v)}
                onClearShareEmbedCode={() => setShareEmbedCode('')}
                posterUrl={shareCardPosterUrl}
                title={data.info.title}
                onShareAction={handleShareAction}
                onCopyEmbedCode={handleCopyEmbedCode}
            />
            <ForYouPlayerEpisodeSpeedIntroDrawers
                data={data}
                episodeIndex={0}
                staticBase={staticBase}
                viewerIsVip={userStore.isVIP()}
                episodeStatus={false}
                onToggleEpisodeDrawer={() => undefined}
                episode={episode}
                episodeRef={episodeRef}
                onSelectEpisodeIndex={() => undefined}
                hideSpeedDrawer
                introduction={introductionOpen}
                onIntroductionOpenChange={(open) => setIntroductionOpen(open ?? false)}
                onCloseIntroductionLinks={() => setIntroductionOpen(false)}
                hideEpisodeDrawer
                tagsFromBackendOnly
                maxTags={FORYOU_MAX_VISIBLE_TAGS}
            />
        </div>
    );
}
