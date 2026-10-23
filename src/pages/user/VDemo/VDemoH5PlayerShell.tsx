import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
} from 'react';

import {
    DouyinFeedPlayer,
    type DouyinFeedNavigateHandle,
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
} from '@/components/douyin-feed-player';
import { FeedPlayerBottomInfo } from '@/components/feed';
import {
    VideoPlayerVipCommerce,
    type VideoPlayerVipCommerceHandle,
} from '@/components/video-player/VideoPlayerVipCommerce';
import { VideoPlayerH5BackBar } from '@/components/video-player/VideoPlayerH5BackBar';
// Legacy cold-unmute overlay import, currently disabled:
// import { VideoPlayerH5ColdUnmuteOverlay } from '@/components/video-player/VideoPlayerH5ColdUnmuteOverlay';
import { VideoPlayerLockOverlay } from '@/components/video-player/VideoPlayerLockOverlay';
import { VideoPlayerRatingDialog } from '@/components/video-player/VideoPlayerRatingDialog';
import { VideoPlayerSideActions } from '@/components/video-player/VideoPlayerSideActions';
import { VideoPlayerAmbientLayer } from '@/components/video-player/VideoPlayerAmbient';
import { useVideoPlayerAmbient } from '@/components/video-player/useVideoPlayerAmbient';
// Legacy cold-unmute hook imports, currently disabled:
// import { useFeedPlayerColdUnmuteVisible } from '@/components/video-player/useFeedPlayerColdUnmuteVisible';
// import { useFeedPlayerTapToUnmute } from '@/components/video-player/useFeedPlayerTapToUnmute';
import { useVideoPlayerBack } from '@/components/video-player/useVideoPlayerBack';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useForyouFeedStore } from '@/stores/foryouFeed';
import { useUserStore } from '@/stores/user';
import { resolveVideoFavorite, setVideoFavoriteOverride } from '@/stores/videoFavorite';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/components/foryou-feed/foryouConstants';
import { useVideoPlayerShare } from '@/components/video-player/useVideoPlayerShare';
import {
    VideoPlayerEpisodeSpeedIntroDrawers as ForYouPlayerEpisodeSpeedIntroDrawers,
} from '@/components/video-player/views/VideoPlayerEpisodeSpeedIntroDrawers';
import { useReportEpProgressAt5s } from '@/hooks/useReportEpProgressAt5s';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useDramaEngagement } from '@/hooks/useDramaEngagement';
import { resolveVideoPosterUrl } from '@/components/video-player/videoPlayerShareUrl';
import { cn } from '@/lib/utils';

import type { VDemoPlayerData } from './fetchVDemoMovieInfo';
import { fetchVDemoActiveEpisode } from './fetchVDemoEpisode';
import { resolveVDemoShellEpisode, useVDemoActiveEpisode } from './vDemoShellEpisode';
import { applyVDemoEpisodeUnlock, isVDemoEpisodeLocked, resolveVDemoDrawerEpisodeLocked } from './vDemoUnlock';
import { useVDemoForyouResumeHandler } from './vDemoForyouResume';

type VDemoH5PlayerShellProps = {
    staticBase: string;
    playerData: VDemoPlayerData;
    playerItems: DouyinFeedVideoItem[];
    activeIndex: number;
    initialIndex: number;
    foryouResumeTimeSec?: number;
    foryouResumeEpisodeRowId?: number;
    fullscreenTargetRef: RefObject<HTMLElement | null>;
    onFullscreenUiChange?: (active: boolean) => void;
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
    fullscreenTargetRef,
    onFullscreenUiChange,
    onIndexChange,
    onEpisodeUnlocked,
    onEpisodeDetailReady,
}: VDemoH5PlayerShellProps) {
    const userStore = useUserStore();
    const requireAccount = useRequireAccount();
    const data = playerData;
    const activeRow = data.episodes[activeIndex];
    const episodeNo = activeRow?.episode ?? 1;
    const episode = useVDemoActiveEpisode(activeRow, userStore.isVIP(), onEpisodeDetailReady);
    const activeLocked = isVDemoEpisodeLocked(activeRow, true);
    const viewerIsVip = Boolean(userStore.signed && userStore.isVIP());
    const resolveEpisodeCellLocked = useCallback(
        (row: VDemoPlayerData['episodes'][number]) =>
            resolveVDemoDrawerEpisodeLocked(row, viewerIsVip),
        [viewerIsVip],
    );
    const isFeedItemLocked = useCallback(
        (_item: DouyinFeedVideoItem, index: number) => isVDemoEpisodeLocked(data.episodes[index], true),
        [data.episodes],
    );
    const vipCommerceRef = useRef<VideoPlayerVipCommerceHandle>(null);
    const activePlayerItem = playerItems[activeIndex];
    const hasNext = activeIndex < data.episodes.length - 1;
    const episodeRef = useRef<HTMLDivElement>(null);
    const feedNavigateRef = useRef<DouyinFeedNavigateHandle | null>(null);
    const navigationAttemptRef = useRef(0);
    const [blockedEpisode, setBlockedEpisode] = useState<{
        index: number;
        detail: IPlayerEpisode | null;
    } | null>(null);
    const commerceRow = blockedEpisode ? data.episodes[blockedEpisode.index] : activeRow;
    const commerceEpisode = blockedEpisode
        ? blockedEpisode.detail ?? resolveVDemoShellEpisode(commerceRow)
        : episode;
    const commerceLocked = blockedEpisode != null || activeLocked;

    const [favorite, setFavorite] = useState(() =>
        resolveVideoFavorite(data.info.id, data.info.is_favorite === 1),
    );
    const engagement = useDramaEngagement({
        dramaId: data.info.id,
        initialLiked: data.info.is_like === true,
        initialLikeCount: data.info.like,
        initialRatingScore: data.info.my_rating,
    });
    const [introductionOpen, setIntroductionOpen] = useState(false);
    const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
    const [isFullscreenUi, setIsFullscreenUi] = useState(false);
    const { ambientEnabled, toggleAmbient } = useVideoPlayerAmbient();

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
    } = useVideoPlayerShare(data);

    const shareCardPosterUrl = resolveVideoPosterUrl(staticBase, data.info, data.info.id);
    useEffect(() => {
        setFavorite(resolveVideoFavorite(data.info.id, data.info.is_favorite === 1));
    }, [data.info.id, data.info.is_favorite]);

    useEffect(() => {
        navigationAttemptRef.current += 1;
        setBlockedEpisode(null);
    }, [activeIndex]);

    const handleToggleFavorite = useCallback(() => {
        if (!requireAccount()) return;
        setFavorite((prev) => {
            const next = !prev;
            setVideoFavoriteOverride(data.info.id, next);
            useForyouFeedStore.getState().patchFavorite(data.info.id, next);
            return next;
        });
        if (!skipRemoteApi) {
            void api('movie/favorite', {
                method: 'post',
                data: { id: data.info.id },
                loading: false,
            });
        }
    }, [data.info.id, requireAccount]);

    const handlePaySuccessEpisodeDetail = useCallback(
        (detail: IPlayerEpisode) => {
            const targetIndex = blockedEpisode?.index;
            applyVDemoEpisodeUnlock(detail);
            setBlockedEpisode(null);
            onEpisodeUnlocked();
            if (targetIndex != null) {
                requestAnimationFrame(() => feedNavigateRef.current?.goToIndex(targetIndex));
            }
        },
        [blockedEpisode?.index, onEpisodeUnlocked],
    );

    const handleIncomingIndex = useCallback(
        (index: number) => {
            const row = data.episodes[index];
            if (viewerIsVip || !row || !resolveVDemoDrawerEpisodeLocked(row, false)) {
                return true;
            }

            const attempt = ++navigationAttemptRef.current;
            void fetchVDemoActiveEpisode(row.id, false)
                .then((detail) => {
                    if (attempt !== navigationAttemptRef.current) {
                        return;
                    }
                    if (detail) {
                        applyVDemoEpisodeUnlock(detail);
                        onEpisodeUnlocked();
                    }
                    if (detail && !detail.lock) {
                        setBlockedEpisode(null);
                        requestAnimationFrame(() => feedNavigateRef.current?.goToIndex(index));
                        return;
                    }
                    setBlockedEpisode({ index, detail });
                    requestAnimationFrame(() => vipCommerceRef.current?.openVip());
                })
                .catch(() => {
                    if (attempt !== navigationAttemptRef.current) {
                        return;
                    }
                    setBlockedEpisode({ index, detail: null });
                    requestAnimationFrame(() => vipCommerceRef.current?.openVip());
                });
            return false;
        },
        [data.episodes, onEpisodeUnlocked, viewerIsVip],
    );

    const handleFeedNext = useCallback(() => {
        if (!hasNext) {
            return;
        }
        feedNavigateRef.current?.next();
    }, [hasNext]);

    const handleSelectEpisodeIndex = useCallback(
        (listIndex: number) => {
            setEpisodeDrawerOpen(false);
            if (listIndex === activeIndex) {
                return;
            }
            feedNavigateRef.current?.goToIndex(listIndex);
        },
        [activeIndex],
    );

    /* Legacy cold-unmute overlay wiring is intentionally disabled, not deleted.
    const coldUnmuteVisible = useFeedPlayerColdUnmuteVisible(activeIndex);
    const handleTapToUnmute = useFeedPlayerTapToUnmute();
    */
    const handleBack = useVideoPlayerBack();
    const handleForyouResume = useVDemoForyouResumeHandler(
        foryouResumeTimeSec,
        foryouResumeEpisodeRowId,
        activeRow?.id,
        activePlayerItem?.id,
    );

    useReportEpProgressAt5s({
        movieId: data.info.id,
        epId: activeRow?.id ?? 0,
        epNo: episodeNo,
        playerItemId: activePlayerItem?.id ?? activeRow?.id ?? 0,
        enabled: !activeLocked && Boolean(activeRow?.id),
    });

    return (
        <div className="v-demo-h5-shell relative h-full w-full">
            {!isFullscreenUi ? (
                <VideoPlayerH5BackBar episodeNo={episodeNo} onBack={handleBack} />
            ) : null}
            <DouyinFeedPlayer
                className="v-demo-h5-player h-full w-full"
                items={playerItems}
                mediaBaseUrl={staticBase}
                preloadNext
                initialIndex={initialIndex}
                fullscreenTargetRef={fullscreenTargetRef}
                onFullscreenUiChange={handleFullscreenUiChange}
                onIndexChange={onIndexChange}
                feedNavigateRef={feedNavigateRef}
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
                isItemLocked={isFeedItemLocked}
                onIncomingIndex={handleIncomingIndex}
            />
            <VideoPlayerAmbientLayer
                active={ambientEnabled && !activeLocked}
                playerItemId={activePlayerItem?.id ?? activeRow?.id ?? 0}
            />
            {/* Legacy cold-unmute overlay; keep commented for possible reuse.
            <VideoPlayerH5ColdUnmuteOverlay
                visible={coldUnmuteVisible && !activeLocked}
                onTapToUnmute={handleTapToUnmute}
            />
            */}
            {activeLocked ? (
                <VideoPlayerLockOverlay
                    variant="h5"
                    onUnlock={() => vipCommerceRef.current?.openVip()}
                />
            ) : null}
            <div
                className={cn(
                    'v-demo-h5-chrome pointer-events-none absolute inset-0 z-10',
                    isFullscreenUi && 'hidden',
                )}
            >
                <VideoPlayerSideActions
                    variant="h5"
                    showVip={!userStore.isVIP()}
                    favorite={favorite}
                    favoriteCount={data.info.favorite}
                    liked={engagement.liked}
                    likeCount={engagement.count}
                    ratingScore={engagement.ratingScore}
                    ambient={ambientEnabled}
                    showEpisodeList
                    onVipClick={(ev) => vipCommerceRef.current?.toggleVip(ev)}
                    onFavoriteClick={handleToggleFavorite}
                    onLikeClick={engagement.handleToggleLike}
                    onRatingClick={() => engagement.setRatingOpen(true)}
                    onAmbientClick={toggleAmbient}
                    onEpisodeListClick={() => setEpisodeDrawerOpen(true)}
                    onShareClick={() => void handleShareAction('link')}
                />
            </div>
            <VideoPlayerVipCommerce
                ref={vipCommerceRef}
                variant="h5"
                episodeRowId={commerceRow?.id ?? 0}
                locked={commerceLocked}
                episode={commerceEpisode}
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
                resolveEpisodeCellLocked={resolveEpisodeCellLocked}
            />
            <VideoPlayerRatingDialog
                open={engagement.ratingOpen}
                title={data.info.title}
                score={engagement.ratingScore}
                variant="h5"
                submitting={engagement.ratingSubmitting}
                onOpenChange={engagement.setRatingOpen}
                onSubmit={(score) => void engagement.handleSubmitRating(score)}
            />
        </div>
    );
}
