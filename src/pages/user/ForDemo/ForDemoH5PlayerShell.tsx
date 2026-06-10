import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Star } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router';

import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import {
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
    DouyinFeedPlayer,
} from '@/components/douyin-feed-player';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useUserStore } from '@/stores/user';
import { buildPlayerDataFromFeedItem, buildEpisodeFromFeedItem } from '@/pages/user/ForYouPage/foryouFeedUtils';
import { navigateFromForyouToVideo } from '@/pages/user/ForYouPage/foryouNavigateToVideo';
import {
    ForYouPlayerEpisodeSpeedIntroDrawers,
    ForYouPlayerH5CommerceDrawers,
    useForYouPlayerShare,
} from '@/pages/user/ForYouPage/forYouPlayerOverlays';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/pages/user/ForYouPage/foryouConstants';
import { formatFavoriteCountK } from '@/pages/user/VideoPage/videoPlayerUtils';
import { resolveVideoPosterUrl } from '@/pages/user/VideoPage/videoPlayerShareUrl';
import type { IForYouFeedItem } from '@/types/foryouFeed';

import { ForDemoFeedControlsTop } from './ForDemoFeedControlsTop';
import { ForDemoColdUnmuteOverlay } from './ForDemoColdUnmuteOverlay';
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
        navigateFromForyouToVideo(navigate, feedItem, 0, activeIndex);
    }, [activeIndex, feedItem, navigate]);

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
            <ForDemoColdUnmuteOverlay activeIndex={activeIndex} />
            <div className="for-demo-h5-chrome pointer-events-none absolute inset-0 z-10">
                <div
                    className="video-player-h5-side-actions absolute right-4 flex flex-col gap-4 pointer-events-auto"
                    data-vertical-swipe-ignore
                >
                    {!userStore.isVIP() ? (
                        <div
                            className="flex cursor-pointer flex-col items-center gap-1"
                            onClick={handleToggleVip}
                        >
                            <Crown className="h-8 w-8 fill-[#ffd000] text-[#ffd000]" />
                            <div className="h-4 text-center text-xs leading-4 text-[#ffd000]">
                                <FormattedMessage id="shopping_vip_fab_label" />
                            </div>
                        </div>
                    ) : null}
                    <div
                        className="flex cursor-pointer flex-col items-center gap-1"
                        onClick={handleToggleFavorite}
                    >
                        <Star
                            className={cn(
                                'h-8 w-8 fill-white text-white',
                                favorite && 'fill-[#ffd000] stroke-[#ffd000]',
                            )}
                        />
                        <div className="h-4 text-center text-xs leading-4 text-white">
                            {formatFavoriteCountK(data.info.favorite)}
                        </div>
                    </div>
                    <div
                        className="flex cursor-pointer flex-col items-center gap-1"
                        onClick={() => setShareOpen(true)}
                    >
                        <img src={shareEntryIcon} alt="" className="w-8 h-8" />
                        <div className="h-4 text-center text-xs leading-4 text-white">
                            <FormattedMessage id="share" />
                        </div>
                    </div>
                </div>
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
