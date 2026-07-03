import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
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
import { VideoPlayerLockOverlay } from '@/components/video-player/VideoPlayerLockOverlay';
import { VideoPlayerPcBackBar } from '@/components/video-player/VideoPlayerPcBackBar';
import { VideoPlayerPcEpisodeNav } from '@/components/video-player/VideoPlayerPcEpisodeNav';
import { VideoPlayerPcUnmuteOverlay } from '@/components/video-player/VideoPlayerPcUnmuteOverlay';
import { VideoPlayerSideActions } from '@/components/video-player/VideoPlayerSideActions';
import { useFeedPlayerColdUnmuteVisible } from '@/components/video-player/useFeedPlayerColdUnmuteVisible';
import { useFeedPlayerTapToUnmute } from '@/components/video-player/useFeedPlayerTapToUnmute';
import { useVideoPlayerBack } from '@/components/video-player/useVideoPlayerBack';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useUserStore } from '@/stores/user';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/components/foryou-feed/foryouConstants';
import { useVideoPlayerShare } from '@/components/video-player/useVideoPlayerShare';
import { VideoPlayerPcEpisodeDrawer as ForYouPlayerPcEpisodeDrawer } from '@/components/video-player/views/VideoPlayerPcEpisodeDrawer';
import { VideoPlayerPcIntroDrawer as ForYouPlayerPcIntroDrawer } from '@/components/video-player/views/VideoPlayerPcIntroDrawer';
import { measurePcStageShiftPx } from '@/components/video-player/videoPlayerPcDrawerStageShift';
import {
    buildPcEpisodeTabRanges,
    pcEpisodeTabIndexForEpisodeNo,
} from '@/components/video-player/videoPlayerPcEpisodeTabs';
import {
    PC_DRAWER_DURATION_MS,
    schedulePcDrawerEnterFrame,
    type PcDrawerPanel,
} from '@/components/video-player/videoPlayerPcDrawerMotion';
import { usePcPlayerRightRailAlign } from '@/components/video-player/usePcPlayerRightRailAlign';
import { useReportEpProgressAt5s } from '@/hooks/useReportEpProgressAt5s';
import { resolveVideoPosterUrl } from '@/components/video-player/videoPlayerShareUrl';

import type { VDemoPlayerData } from './fetchVDemoMovieInfo';
import { useVDemoActiveEpisode } from './vDemoShellEpisode';
import { applyVDemoEpisodeUnlock, isVDemoEpisodeLocked, resolveVDemoDrawerEpisodeLocked } from './vDemoUnlock';
import { useVDemoForyouResumeHandler } from './vDemoForyouResume';

type VDemoPcPlayerShellProps = {
    staticBase: string;
    playerData: VDemoPlayerData;
    playerItems: DouyinFeedVideoItem[];
    activeIndex: number;
    initialIndex: number;
    foryouResumeTimeSec?: number;
    foryouResumeEpisodeRowId?: number;
    fullscreenTargetRef: RefObject<HTMLElement | null>;
    isDesktop?: boolean;
    onFullscreenUiChange?: (active: boolean) => void;
    onIndexChange: (index: number, direction?: FeedNavigateDirection) => void;
    onEpisodeUnlocked: () => void;
    onEpisodeDetailReady: () => void;
};

export function VDemoPcPlayerShell({
    staticBase,
    playerData,
    playerItems,
    activeIndex,
    initialIndex,
    foryouResumeTimeSec,
    foryouResumeEpisodeRowId,
    fullscreenTargetRef,
    isDesktop = true,
    onFullscreenUiChange,
    onIndexChange,
    onEpisodeUnlocked,
    onEpisodeDetailReady,
}: VDemoPcPlayerShellProps) {
    const userStore = useUserStore();
    const data = playerData;
    const activeRow = data.episodes[activeIndex];
    const episodeNo = activeRow?.episode ?? 1;
    const episode = useVDemoActiveEpisode(activeRow, userStore.isVIP(), onEpisodeDetailReady);
    const activeLocked = isVDemoEpisodeLocked(activeRow, true);
    const viewerIsVip = Boolean(userStore.signed && userStore.isVIP());
    const resolveEpisodeCellLocked = useCallback(
        (row: typeof data.episodes[number]) => resolveVDemoDrawerEpisodeLocked(row, viewerIsVip),
        [viewerIsVip, playerItems, episode],
    );
    const isFeedItemLocked = useCallback(
        (_item: DouyinFeedVideoItem, index: number) => isVDemoEpisodeLocked(data.episodes[index], true),
        [data.episodes],
    );
    const vipCommerceRef = useRef<VideoPlayerVipCommerceHandle>(null);
    const activePlayerItem = playerItems[activeIndex];
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < data.episodes.length - 1;

    const maxEpisode = useMemo(() => {
        if (!data.episodes.length) {
            return 1;
        }
        return Math.max(...data.episodes.map((row) => Number(row.episode)));
    }, [data.episodes]);

    const tabRanges = useMemo(() => buildPcEpisodeTabRanges(maxEpisode), [maxEpisode]);

    const [favorite, setFavorite] = useState(data.info.is_favorite === 1);
    const [pcDrawerPanel, setPcDrawerPanel] = useState<PcDrawerPanel>(null);
    const [pcDrawerEntered, setPcDrawerEntered] = useState(false);
    const [pcStageShiftPx, setPcStageShiftPx] = useState(0);
    const [desktopEpisodeTab, setDesktopEpisodeTab] = useState(() =>
        pcEpisodeTabIndexForEpisodeNo(episodeNo, tabRanges),
    );
    const pcDrawerClosingRef = useRef(false);
    const feedNavigateRef = useRef<DouyinFeedNavigateHandle | null>(null);
    const [isFullscreenUi, setIsFullscreenUi] = useState(false);

    const handleFullscreenUiChange = useCallback(
        (active: boolean) => {
            setIsFullscreenUi(active);
            onFullscreenUiChange?.(active);
        },
        [onFullscreenUiChange],
    );

    const pcShellRef = useRef<HTMLDivElement>(null);
    const pcStageClusterRef = useRef<HTMLDivElement>(null);
    const videoStageRef = useRef<HTMLDivElement>(null);

    const pcRightRailStyle = usePcPlayerRightRailAlign(pcShellRef, videoStageRef, true);

    const {
        shareOpen,
        setShareOpen,
        shareEmbedCode,
        shareShowControls,
        setShareShowControls,
        handleShareAction,
        handleCopyEmbedCode,
    } = useVideoPlayerShare(data, staticBase, episodeNo);

    const shareCardPosterUrl = resolveVideoPosterUrl(staticBase, data.info, data.info.id);
    const handleForyouResume = useVDemoForyouResumeHandler(
        foryouResumeTimeSec,
        foryouResumeEpisodeRowId,
        activeRow?.id,
        activePlayerItem?.id,
    );

    const filteredEpisodes = useMemo(() => {
        const range = tabRanges[desktopEpisodeTab] ?? { start: 1, end: maxEpisode };
        return data.episodes.filter(
            (row) => row.episode >= range.start && row.episode <= range.end,
        );
    }, [data.episodes, desktopEpisodeTab, maxEpisode, tabRanges]);

    useEffect(() => {
        setFavorite(data.info.is_favorite === 1);
    }, [data.info.id, data.info.is_favorite]);

    useEffect(() => {
        setDesktopEpisodeTab(pcEpisodeTabIndexForEpisodeNo(episodeNo, tabRanges));
    }, [episodeNo, tabRanges]);

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

    const beginClosePcDrawer = useCallback(() => {
        if (!pcDrawerPanel) {
            return;
        }
        pcDrawerClosingRef.current = true;
        setPcDrawerEntered(false);
        setPcStageShiftPx(0);
    }, [pcDrawerPanel]);

    const closePcDrawer = useCallback(
        (ev?: MouseEvent) => {
            ev?.stopPropagation();
            beginClosePcDrawer();
        },
        [beginClosePcDrawer],
    );

    const openPcIntroDrawer = useCallback(
        (ev?: MouseEvent) => {
            ev?.stopPropagation();
            if (pcDrawerPanel === 'intro') {
                beginClosePcDrawer();
                return;
            }
            pcDrawerClosingRef.current = false;
            setPcDrawerPanel('intro');
        },
        [beginClosePcDrawer, pcDrawerPanel],
    );

    const openPcEpisodeDrawer = useCallback(
        (ev?: MouseEvent) => {
            ev?.stopPropagation();
            if (pcDrawerPanel === 'episodes') {
                beginClosePcDrawer();
                return;
            }
            pcDrawerClosingRef.current = false;
            setPcDrawerPanel('episodes');
        },
        [beginClosePcDrawer, pcDrawerPanel],
    );

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

    const handleFeedPrev = useCallback(() => {
        if (!hasPrev) {
            return;
        }
        feedNavigateRef.current?.prev();
    }, [hasPrev]);

    const handleFeedNext = useCallback(() => {
        if (!hasNext) {
            return;
        }
        feedNavigateRef.current?.next();
    }, [hasNext]);

    const handleSelectEpisodeByListIndex = useCallback(
        (listIndex: number) => {
            beginClosePcDrawer();
            if (listIndex === activeIndex) {
                return;
            }
            feedNavigateRef.current?.goToIndex(listIndex);
        },
        [activeIndex, beginClosePcDrawer],
    );

    const coldUnmuteVisible = useFeedPlayerColdUnmuteVisible(activeIndex);
    const handleTapToUnmute = useFeedPlayerTapToUnmute();
    const handleBack = useVideoPlayerBack();

    useReportEpProgressAt5s({
        movieId: data.info.id,
        epId: activeRow?.id ?? 0,
        epNo: episodeNo,
        playerItemId: activePlayerItem?.id ?? activeRow?.id ?? 0,
        enabled: !activeLocked && Boolean(activeRow?.id),
    });

    useEffect(() => {
        if (pcDrawerPanel == null) {
            setPcDrawerEntered(false);
            setPcStageShiftPx(0);
            return;
        }
        if (pcDrawerClosingRef.current) {
            return;
        }
        if (pcDrawerEntered) {
            return schedulePcDrawerEnterFrame(() => {
                const shell = pcShellRef.current;
                const cluster = pcStageClusterRef.current;
                if (shell && cluster) {
                    setPcStageShiftPx(measurePcStageShiftPx(shell, cluster));
                }
            });
        }
        setPcDrawerEntered(false);
        setPcStageShiftPx(0);
        return schedulePcDrawerEnterFrame(() => {
            setPcDrawerEntered(true);
            const shell = pcShellRef.current;
            const cluster = pcStageClusterRef.current;
            if (shell && cluster) {
                setPcStageShiftPx(measurePcStageShiftPx(shell, cluster));
            }
        });
    }, [pcDrawerPanel, pcDrawerEntered]);

    useEffect(() => {
        if (!pcDrawerClosingRef.current || pcDrawerPanel == null || pcDrawerEntered) {
            return;
        }
        const finish = () => {
            pcDrawerClosingRef.current = false;
            setPcDrawerPanel(null);
            setPcStageShiftPx(0);
        };
        const panel = pcShellRef.current?.querySelector<HTMLElement>(
            '.video-pc-right-drawer--open .video-pc-right-drawer__panel',
        );
        if (!panel) {
            finish();
            return;
        }
        const onEnd = (e: TransitionEvent) => {
            if (e.target === panel && e.propertyName === 'transform') {
                finish();
            }
        };
        panel.addEventListener('transitionend', onEnd);
        const fallback = window.setTimeout(finish, PC_DRAWER_DURATION_MS + 80);
        return () => {
            panel.removeEventListener('transitionend', onEnd);
            window.clearTimeout(fallback);
        };
    }, [pcDrawerPanel, pcDrawerEntered]);

    return (
        <div className="video-player-root h-full w-full relative">
            <div
                ref={pcShellRef}
                className={cn(
                    'video-player-pc-shell relative flex h-full w-full items-center justify-center overflow-hidden bg-black',
                    pcDrawerPanel != null && 'video-player-pc-shell--drawer-open',
                )}
            >
                <div
                    ref={pcStageClusterRef}
                    className="video-player-pc-stage-cluster flex h-full max-h-full flex-row items-center justify-center"
                    style={{
                        transform:
                            pcStageShiftPx > 0
                                ? `translate3d(-${pcStageShiftPx}px, 0, 0)`
                                : undefined,
                    }}
                >
                    <div
                        ref={videoStageRef}
                        className="relative flex h-full max-h-full w-auto max-w-full flex-col aspect-[9/16] overflow-hidden bg-black"
                    >
                        <DouyinFeedPlayer
                            className="v-demo-pc-player h-full w-full"
                            items={playerItems}
                            mediaBaseUrl={staticBase}
                            initialIndex={initialIndex}
                            preloadNext
                            fullscreenTargetRef={fullscreenTargetRef}
                            isDesktop={isDesktop}
                            feedNavigateRef={feedNavigateRef}
                            onFullscreenUiChange={handleFullscreenUiChange}
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
                                    onOpenIntroduction={openPcIntroDrawer}
                                />
                            }
                            isItemLocked={isFeedItemLocked}
                        />
                        <VideoPlayerPcUnmuteOverlay
                            visible={coldUnmuteVisible && !activeLocked}
                            onTapToUnmute={handleTapToUnmute}
                        />
                        {activeLocked ? (
                            <div className="video-player-ui pointer-events-auto absolute inset-0 z-10">
                                <VideoPlayerLockOverlay
                                    onUnlock={() => vipCommerceRef.current?.openVip()}
                                />
                            </div>
                        ) : null}
                    </div>
                    {!isFullscreenUi ? (
                        <VideoPlayerSideActions
                            variant="pc"
                            showVip={!userStore.isVIP()}
                            favorite={favorite}
                            favoriteCount={data.info.favorite}
                            showEpisodeList
                            onVipClick={(ev) => vipCommerceRef.current?.toggleVip(ev)}
                            onFavoriteClick={handleToggleFavorite}
                            onEpisodeListClick={openPcEpisodeDrawer}
                            onShareClick={() => setShareOpen(true)}
                        />
                    ) : null}
                </div>
                {!isFullscreenUi ? (
                    <div
                        className={cn(
                            'video-player-pc-right-rail',
                            pcDrawerPanel != null && 'video-player-pc-right-rail--drawer-open',
                        )}
                        style={pcRightRailStyle}
                    >
                        <ForYouPlayerPcIntroDrawer
                            open={pcDrawerPanel === 'intro'}
                            entered={pcDrawerEntered && pcDrawerPanel === 'intro'}
                            onClose={closePcDrawer}
                            anchorRef={videoStageRef}
                            data={data}
                            episode={episode}
                            staticBase={staticBase}
                            tagsFromBackendOnly
                            maxTags={FORYOU_MAX_VISIBLE_TAGS}
                        />
                        <ForYouPlayerPcEpisodeDrawer
                            open={pcDrawerPanel === 'episodes'}
                            entered={pcDrawerEntered && pcDrawerPanel === 'episodes'}
                            onClose={closePcDrawer}
                            anchorRef={videoStageRef}
                            currentEpisodeNo={episodeNo}
                            data={data}
                            viewerIsVip={userStore.isVIP()}
                            tabRanges={tabRanges}
                            activeTab={desktopEpisodeTab}
                            onSelectEpisodeTab={setDesktopEpisodeTab}
                            filteredEpisodes={filteredEpisodes}
                            onSelectEpisodeByListIndex={handleSelectEpisodeByListIndex}
                            resolveEpisodeCellLocked={resolveEpisodeCellLocked}
                        />
                        <VideoPlayerPcEpisodeNav
                            hasPrev={hasPrev}
                            hasNext={hasNext}
                            onPrev={handleFeedPrev}
                            onNext={handleFeedNext}
                        />
                    </div>
                ) : null}
                {!isFullscreenUi ? (
                    <VideoPlayerPcBackBar episodeNo={episodeNo} onBack={handleBack} />
                ) : null}
            </div>
            <VideoPlayerVipCommerce
                ref={vipCommerceRef}
                variant="pc"
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
                posterUrl={shareCardPosterUrl}
                title={data.info.title}
                introduction={data.info.introduction ?? ''}
                onShareAction={handleShareAction}
                onCopyEmbedCode={handleCopyEmbedCode}
            />
        </div>
    );
}
