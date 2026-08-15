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
import { VideoPlayerSideActions } from '@/components/video-player/VideoPlayerSideActions';
import { TikTokRewardedFallbackOverlay } from '@/components/video-player/TikTokRewardedFallbackOverlay';
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
import { resolveVideoPosterUrl } from '@/components/video-player/videoPlayerShareUrl';
import { cn } from '@/lib/utils';
import { resolveStaticMediaUrl } from '@/lib/resolveStaticMediaUrl';
import { isTikTokPlatform } from '@/platform';
import { prepareTikTokRewardedEpisodeUnlock } from '@/lib/tiktokRewardedEpisodeUnlock';

import type { VDemoPlayerData } from './fetchVDemoMovieInfo';
import { useVDemoActiveEpisode } from './vDemoShellEpisode';
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
    const lastTikTokPrewarmAtRef = useRef<Map<number, number>>(new Map());

    const [favorite, setFavorite] = useState(() =>
        resolveVideoFavorite(data.info.id, data.info.is_favorite === 1),
    );
    const [introductionOpen, setIntroductionOpen] = useState(false);
    const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
    const [isFullscreenUi, setIsFullscreenUi] = useState(false);

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
    } = useVideoPlayerShare(data, staticBase, episodeNo);

    const shareCardPosterUrl = resolveVideoPosterUrl(staticBase, data.info, data.info.id);
    const tiktokAutoLaunchedEpisodeIdsRef = useRef(new Set<number>());
    const getTikTokLockedPosterUrl = useCallback(
        (_item: DouyinFeedVideoItem, index: number) => {
            if (!isTikTokPlatform()) return '';
            const episodeImage = String(data.episodes[index]?.image ?? '').trim();
            return episodeImage
                ? resolveStaticMediaUrl(episodeImage, staticBase)
                : shareCardPosterUrl;
        },
        [data.episodes, shareCardPosterUrl, staticBase],
    );
    const firstLockedIndex = data.episodes.findIndex(resolveEpisodeCellLocked);
    const tiktokEpisodeOrderBlocked = Boolean(
        isTikTokPlatform()
        && !viewerIsVip
        && activeLocked
        && firstLockedIndex >= 0
        && activeIndex > firstLockedIndex,
    );
    const prepareTikTokEpisodeAtIndex = useCallback(
        (index: number) => {
            if (!isTikTokPlatform()) return;
            const firstLocked = data.episodes.findIndex(resolveEpisodeCellLocked);
            if (firstLocked < 0 || index !== firstLocked) return;

            const episodeId = Number(data.episodes[index]?.id);
            if (!episodeId) return;
            const now = Date.now();
            const lastAttemptAt = lastTikTokPrewarmAtRef.current.get(episodeId) ?? 0;
            if (now - lastAttemptAt < 5_000) return;
            lastTikTokPrewarmAtRef.current.set(episodeId, now);
            if (tiktokAutoLaunchedEpisodeIdsRef.current.has(episodeId)) return;
            tiktokAutoLaunchedEpisodeIdsRef.current.add(episodeId);

            void prepareTikTokRewardedEpisodeUnlock(episodeId)
                .then(() => {
                    vipCommerceRef.current?.openRewardedAd(episodeId);
                })
                .catch((error) => {
                    tiktokAutoLaunchedEpisodeIdsRef.current.delete(episodeId);
                    console.warn('[TikTok ad unlock] Prepare failed.', {
                        episodeId,
                        error,
                    });
                });
        },
        [data.episodes, resolveEpisodeCellLocked],
    );
    const renderTikTokLockedOverlay = useCallback(
        (item: DouyinFeedVideoItem, index: number) => {
            if (!isTikTokPlatform()) return null;
            const episodeOrderBlocked = Boolean(
                !viewerIsVip
                && firstLockedIndex >= 0
                && index > firstLockedIndex,
            );
            return (
                <TikTokRewardedFallbackOverlay
                    posterUrl={getTikTokLockedPosterUrl(item, index)}
                    episodeOrderBlocked={episodeOrderBlocked}
                    onRetry={() => {
                        if (!episodeOrderBlocked) {
                            vipCommerceRef.current?.openRewardedAd(
                                Number(data.episodes[index]?.id),
                            );
                        }
                    }}
                />
            );
        },
        [data.episodes, firstLockedIndex, getTikTokLockedPosterUrl, viewerIsVip],
    );
    const activeTikTokLockedPosterUrl = getTikTokLockedPosterUrl(
        activePlayerItem,
        activeIndex,
    );

    useEffect(() => {
        setFavorite(resolveVideoFavorite(data.info.id, data.info.is_favorite === 1));
    }, [data.info.id, data.info.is_favorite]);

    const handleToggleFavorite = useCallback(() => {
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
        feedNavigateRef.current?.next();
    }, [hasNext]);

    const handleSelectEpisodeIndex = useCallback(
        (listIndex: number) => {
            setEpisodeDrawerOpen(false);
            if (listIndex === activeIndex) {
                return;
            }
            prepareTikTokEpisodeAtIndex(listIndex);
            feedNavigateRef.current?.goToIndex(listIndex);
        },
        [activeIndex, prepareTikTokEpisodeAtIndex],
    );

    const handleIncomingIndex = useCallback(
        (index: number) => {
            prepareTikTokEpisodeAtIndex(index);
        },
        [prepareTikTokEpisodeAtIndex],
    );

    useEffect(() => {
        if (activeLocked) {
            prepareTikTokEpisodeAtIndex(activeIndex);
        }
    }, [activeIndex, activeLocked, prepareTikTokEpisodeAtIndex]);

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
                getLockedPosterUrl={isTikTokPlatform() ? getTikTokLockedPosterUrl : undefined}
                renderLockedOverlay={isTikTokPlatform() ? renderTikTokLockedOverlay : undefined}
                onIncomingIndex={isTikTokPlatform() ? handleIncomingIndex : undefined}
                preventNextFromLockedItem={isTikTokPlatform()}
            />
            {/* Legacy cold-unmute overlay; keep commented for possible reuse.
            <VideoPlayerH5ColdUnmuteOverlay
                visible={coldUnmuteVisible && !activeLocked}
                onTapToUnmute={handleTapToUnmute}
            />
            */}
            {activeLocked && !isTikTokPlatform() ? (
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
                tiktokEpisodeOrderBlocked={tiktokEpisodeOrderBlocked}
                showTikTokLockedOverlay={false}
                episode={episode}
                viewerIsVip={viewerIsVip}
                onPaySuccessEpisodeDetail={handlePaySuccessEpisodeDetail}
                shareOpen={shareOpen}
                onShareOpenChange={setShareOpen}
                shareEmbedCode={shareEmbedCode}
                shareShowControls={shareShowControls}
                onToggleShareShowControls={() => setShareShowControls((v) => !v)}
                onClearShareEmbedCode={() => setShareEmbedCode('')}
                posterUrl={
                    isTikTokPlatform() && activeLocked
                        ? activeTikTokLockedPosterUrl
                        : shareCardPosterUrl
                }
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
        </div>
    );
}
