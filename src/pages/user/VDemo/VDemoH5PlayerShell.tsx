import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
    DouyinFeedPlayer,
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
} from '@/components/douyin-feed-player';
import { FeedPlayerBottomInfo } from '@/components/feed';
import {
    VideoPlayerH5BackBar,
    VideoPlayerH5ColdUnmuteOverlay,
    VideoPlayerLockOverlay,
    VideoPlayerSideActions,
    VideoPlayerVipCommerce,
    type VideoPlayerVipCommerceHandle,
    useFeedPlayerColdUnmuteVisible,
    useFeedPlayerTapToUnmute,
    useVideoPlayerBack,
} from '@/components/video-player';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useUserStore } from '@/stores/user';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/components/foryou-feed/foryouConstants';
import {
    ForYouPlayerEpisodeSpeedIntroDrawers,
    useForYouPlayerShare,
} from '@/components/foryou-feed/forYouPlayerOverlays';
import { resolveVideoPosterUrl } from '@/components/video-player/videoPlayerShareUrl';

import type { VDemoPlayerData } from './fetchVDemoMovieInfo';
import { scrollVDemoFeedToIndex } from './vDemoFeedScroll';
import { useVDemoActiveEpisode } from './vDemoShellEpisode';
import { applyVDemoEpisodeUnlock, isVDemoEpisodeLocked } from './vDemoUnlock';
import { useVDemoForyouResumeHandler } from './vDemoForyouResume';

type VDemoH5PlayerShellProps = {
    staticBase: string;
    playerData: VDemoPlayerData;
    playerItems: DouyinFeedVideoItem[];
    activeIndex: number;
    initialIndex: number;
    foryouResumeTimeSec?: number;
    foryouResumeEpisodeRowId?: number;
    onIndexChange: (index: number, direction?: FeedNavigateDirection) => void;
    onEpisodeUnlocked: () => void;
    onEpisodeDetailReady: () => void;
};

export function VDemoH5PlayerShell({
    staticBase,
    playerData,
    playerItems,
    activeIndex,
    initialIndex,
    foryouResumeTimeSec,
    foryouResumeEpisodeRowId,
    onIndexChange,
    onEpisodeUnlocked,
    onEpisodeDetailReady,
}: VDemoH5PlayerShellProps) {
    const userStore = useUserStore();
    const data = playerData;
    const activeRow = data.episodes[activeIndex];
    const episodeNo = activeRow?.episode ?? 1;
    const episode = useVDemoActiveEpisode(activeRow, userStore.isVIP(), onEpisodeDetailReady);
    const activeLocked = isVDemoEpisodeLocked(activeRow);
    const viewerIsVip = Boolean(userStore.signed && userStore.isVIP());
    const vipCommerceRef = useRef<VideoPlayerVipCommerceHandle>(null);
    const activePlayerItem = playerItems[activeIndex];
    const hasNext = activeIndex < data.episodes.length - 1;
    const episodeRef = useRef<HTMLDivElement>(null);

    const [favorite, setFavorite] = useState(data.info.is_favorite === 1);
    const [introductionOpen, setIntroductionOpen] = useState(false);
    const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);

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
        setFavorite(data.info.is_favorite === 1);
    }, [data.info.id, data.info.is_favorite]);

    useLayoutEffect(() => {
        if (initialIndex <= 0) {
            return;
        }
        const scroller = document.querySelector('.v-demo #sliderVideo') as HTMLElement | null;
        if (!scroller) {
            return;
        }
        const height = scroller.clientHeight || window.innerHeight;
        scroller.scrollTop = initialIndex * height;
    }, [initialIndex, playerItems.length]);

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

    const handlePaySuccessEpisodeDetail = useCallback(
        (detail: IPlayerEpisode) => {
            applyVDemoEpisodeUnlock(detail);
            onEpisodeUnlocked();
        },
        [onEpisodeUnlocked],
    );

    const handleFeedNext = useCallback(() => {
        if (!hasNext) {
            return;
        }
        scrollVDemoFeedToIndex(activeIndex + 1);
    }, [activeIndex, hasNext]);

    const handleSelectEpisodeIndex = useCallback(
        (listIndex: number) => {
            setEpisodeDrawerOpen(false);
            if (listIndex === activeIndex) {
                return;
            }
            onIndexChange(listIndex, listIndex > activeIndex ? 'next' : 'prev');
            scrollVDemoFeedToIndex(listIndex);
        },
        [activeIndex, onIndexChange],
    );

    const coldUnmuteVisible = useFeedPlayerColdUnmuteVisible(activeIndex);
    const handleTapToUnmute = useFeedPlayerTapToUnmute();
    const handleBack = useVideoPlayerBack();
    const handleForyouResume = useVDemoForyouResumeHandler(
        foryouResumeTimeSec,
        foryouResumeEpisodeRowId,
        activeRow?.id,
        activePlayerItem?.id,
    );

    return (
        <div className="v-demo-h5-shell relative h-full w-full">
            <VideoPlayerH5BackBar episodeNo={episodeNo} onBack={handleBack} />
            <DouyinFeedPlayer
                className="v-demo-h5-player h-full w-full"
                items={playerItems}
                mediaBaseUrl={staticBase}
                preloadNext
                initialIndex={initialIndex}
                onIndexChange={onIndexChange}
                showNextEpisode={hasNext}
                onNextEpisode={handleFeedNext}
                onPlaybackModeChange={handleForyouResume}
                controlsTopContent={
                    <FeedPlayerBottomInfo
                        title={data.info.title}
                        introduction={data.info.introduction}
                        episodeNo={episodeNo}
                        tags={data.tags}
                        maxTags={FORYOU_MAX_VISIBLE_TAGS}
                        onOpenIntroduction={() => setIntroductionOpen(true)}
                    />
                }
            />
            <VideoPlayerH5ColdUnmuteOverlay
                visible={coldUnmuteVisible && !activeLocked}
                onTapToUnmute={handleTapToUnmute}
            />
            {activeLocked ? (
                <VideoPlayerLockOverlay
                    variant="h5"
                    onUnlock={() => vipCommerceRef.current?.openVip()}
                />
            ) : null}
            <div className="v-demo-h5-chrome pointer-events-none absolute inset-0 z-10">
                <VideoPlayerSideActions
                    variant="h5"
                    showVip={!userStore.isVIP()}
                    favorite={favorite}
                    favoriteCount={data.info.favorite}
                    showEpisodeList
                    onVipClick={(ev) => vipCommerceRef.current?.toggleVip(ev)}
                    onFavoriteClick={handleToggleFavorite}
                    onEpisodeListClick={() => setEpisodeDrawerOpen(true)}
                    onShareClick={() => setShareOpen(true)}
                />
            </div>
            <VideoPlayerVipCommerce
                ref={vipCommerceRef}
                variant="h5"
                episodeRowId={activeRow?.id ?? 0}
                locked={activeLocked}
                episode={episode}
                viewerIsVip={viewerIsVip}
                onPaySuccessEpisodeDetail={handlePaySuccessEpisodeDetail}
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
                episodeIndex={activeIndex}
                staticBase={staticBase}
                viewerIsVip={userStore.isVIP()}
                episodeStatus={episodeDrawerOpen}
                onToggleEpisodeDrawer={() => setEpisodeDrawerOpen((open) => !open)}
                episode={episode}
                episodeRef={episodeRef}
                onSelectEpisodeIndex={handleSelectEpisodeIndex}
                hideSpeedDrawer
                introduction={introductionOpen}
                onIntroductionOpenChange={(open) => setIntroductionOpen(open ?? false)}
                onCloseIntroductionLinks={() => setIntroductionOpen(false)}
                tagsFromBackendOnly
                maxTags={FORYOU_MAX_VISIBLE_TAGS}
            />
        </div>
    );
}
