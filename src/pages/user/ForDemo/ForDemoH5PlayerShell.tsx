import { useCallback, useEffect, useRef, useState } from 'react';
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
import { buildPlayerDataFromFeedItem, buildEpisodeFromFeedItem } from '@/pages/user/ForYouPage/foryouFeedUtils';
import { buildVDemoPath } from '@/constants/vDemoRoute';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import {
    ForYouPlayerEpisodeSpeedIntroDrawers,
    ForYouPlayerH5CommerceDrawers,
    useForYouPlayerShare,
} from '@/pages/user/ForYouPage/forYouPlayerOverlays';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/pages/user/ForYouPage/foryouConstants';
import { resolveVideoPosterUrl } from '@/pages/user/VideoPage/videoPlayerShareUrl';
import type { IForYouFeedItem } from '@/types/foryouFeed';

import { ForDemoFeedBackTopbar } from './ForDemoFeedBackTopbar';
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
    const episodeRef = useRef<HTMLDivElement>(null);

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
        navigate(buildVDemoPath(feedItem.id, feedItem.episode ?? 1), {
            state: VIDEO_FROM_HOME_STATE,
        });
    }, [feedItem.episode, feedItem.id, navigate]);

    const coldUnmuteVisible = useFeedPlayerColdUnmuteVisible(activeIndex);
    const handleTapToUnmute = useFeedPlayerTapToUnmute();

    return (
        <div className="for-demo-h5-shell relative h-full w-full">
            <DouyinFeedPlayer
                className="for-demo-h5-player h-full w-full"
                items={playerItems}
                mediaBaseUrl={staticBase}
                preloadNext
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
            <div className="for-demo-h5-chrome pointer-events-none absolute inset-0 z-10">
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
                onIntroductionOpenChange={setIntroductionOpen}
                onCloseIntroductionLinks={() => setIntroductionOpen(false)}
                hideEpisodeDrawer
                tagsFromBackendOnly
                maxTags={FORYOU_MAX_VISIBLE_TAGS}
            />
        </div>
    );
}
