import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router';

import {
    DouyinFeedPlayer,
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
} from '@/components/douyin-feed-player';
import { bindWheelNavigate } from '@/components/douyin-feed-player/feed/wheelNavigate';
import {
    VideoPlayerPcEpisodeNav,
    VideoPlayerPcUnmuteOverlay,
    VideoPlayerSideActions,
    useFeedPlayerColdUnmuteVisible,
    useFeedPlayerTapToUnmute,
} from '@/components/video-player';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useUserStore } from '@/stores/user';
import { buildPlayerDataFromFeedItem, buildEpisodeFromFeedItem } from '@/pages/user/ForYouPage/foryouFeedUtils';
import { navigateFromForDemoWatchFull } from '@/pages/user/ForYouPage/foryouNavigateToVideo';
import {
    ForYouPlayerPcCommerceDialogs,
    ForYouPlayerPcIntroDrawer,
    useForYouPlayerShare,
} from '@/pages/user/ForYouPage/forYouPlayerOverlays';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/pages/user/ForYouPage/foryouConstants';
import { measurePcStageShiftPx } from '@/pages/user/VideoPage/videoPlayerPcDrawerStageShift';
import {
    PC_DRAWER_DURATION_MS,
    schedulePcDrawerEnterFrame,
    type PcDrawerPanel,
} from '@/pages/user/VideoPage/videoPlayerPcDrawerMotion';
import { usePcPlayerRightRailAlign } from '@/pages/user/VideoPage/usePcPlayerRightRailAlign';
import { resolveVideoPosterUrl } from '@/pages/user/VideoPage/videoPlayerShareUrl';
import type { IForYouFeedItem } from '@/types/foryouFeed';

import { ForDemoFeedControlsTop } from './ForDemoFeedControlsTop';

type ForDemoPcPlayerShellProps = {
    staticBase: string;
    feedItem: IForYouFeedItem;
    playerItems: DouyinFeedVideoItem[];
    activeIndex: number;
    hasPrev: boolean;
    hasNext: boolean;
    hasMore: boolean;
    listLength: number;
    onIndexChange: (index: number, direction?: FeedNavigateDirection) => void;
    onLoadMore: () => void;
};

export function ForDemoPcPlayerShell({
    staticBase,
    feedItem,
    playerItems,
    activeIndex,
    hasPrev,
    hasNext,
    hasMore,
    listLength,
    onIndexChange,
    onLoadMore,
}: ForDemoPcPlayerShellProps) {
    const navigate = useNavigate();
    const userStore = useUserStore();
    const data = buildPlayerDataFromFeedItem(feedItem);
    const episode = buildEpisodeFromFeedItem(feedItem);
    const episodeNo = feedItem.episode ?? 1;
    const feedEpisodeTotal = feedItem.episodes ?? 0;
    const activePlayerItem = playerItems[activeIndex];

    const [favorite, setFavorite] = useState(
        feedItem.is_favor === true || feedItem.is_favorite === 1,
    );
    const [vip, setVip] = useState(false);
    const [pcDrawerPanel, setPcDrawerPanel] = useState<PcDrawerPanel>(null);
    const [pcDrawerEntered, setPcDrawerEntered] = useState(false);
    const [pcStageShiftPx, setPcStageShiftPx] = useState(0);
    const pcDrawerClosingRef = useRef(false);
    const prevListLengthRef = useRef(listLength);

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
            onIndexChange(activeIndex + 1, 'next');
        }
        prevListLengthRef.current = listLength;
    }, [activeIndex, listLength, onIndexChange]);

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

    const handleToggleVip = useCallback((ev?: MouseEvent) => {
        ev?.stopPropagation();
        if (userStore.signed && userStore.isVIP()) {
            return;
        }
        setVip((open) => !open);
    }, [userStore]);

    const handleFeedPrev = useCallback(() => {
        if (activeIndex <= 0) return;
        onIndexChange(activeIndex - 1, 'prev');
    }, [activeIndex, onIndexChange]);

    const handleFeedNext = useCallback(() => {
        if (activeIndex < playerItems.length - 1) {
            onIndexChange(activeIndex + 1, 'next');
            return;
        }
        if (hasMore) {
            onLoadMore();
        }
    }, [activeIndex, hasMore, onLoadMore, onIndexChange, playerItems.length]);

    const handleWatchFullSeries = useCallback(() => {
        navigateFromForDemoWatchFull(navigate, feedItem, activeIndex);
    }, [activeIndex, feedItem, navigate]);

    const coldUnmuteVisible = useFeedPlayerColdUnmuteVisible(activeIndex);
    const handleTapToUnmute = useFeedPlayerTapToUnmute();

    useEffect(() => {
        const stage = videoStageRef.current;
        if (!stage) {
            return;
        }
        const wheel = bindWheelNavigate(stage, (dir) => {
            if (dir === 'next') {
                handleFeedNext();
            } else {
                handleFeedPrev();
            }
        });
        return () => {
            wheel.dispose();
        };
    }, [handleFeedNext, handleFeedPrev]);

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
        <div className="video-player-root foryou-feed-player h-full w-full relative">
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
                            key={String(activePlayerItem?.id ?? activeIndex)}
                            className="for-demo-pc-player h-full w-full"
                            items={activePlayerItem ? [activePlayerItem] : []}
                            mediaBaseUrl={staticBase}
                            preloadNext={false}
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
                                    onOpenIntroduction={openPcIntroDrawer}
                                    onWatchFullSeries={handleWatchFullSeries}
                                />
                            }
                        />
                        <VideoPlayerPcUnmuteOverlay
                            visible={coldUnmuteVisible}
                            onTapToUnmute={handleTapToUnmute}
                        />
                    </div>
                    <VideoPlayerSideActions
                        variant="pc"
                        showVip={!userStore.isVIP()}
                        favorite={favorite}
                        favoriteCount={data.info.favorite}
                        onVipClick={handleToggleVip}
                        onFavoriteClick={handleToggleFavorite}
                        onShareClick={() => setShareOpen(true)}
                    />
                </div>
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
                    <VideoPlayerPcEpisodeNav
                        hasPrev={hasPrev}
                        hasNext={hasNext || hasMore}
                        onPrev={handleFeedPrev}
                        onNext={handleFeedNext}
                    />
                </div>
            </div>
            <ForYouPlayerPcCommerceDialogs
                vip={vip}
                onVipOpenChange={setVip}
                onVipEmbedClose={() => setVip(false)}
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
