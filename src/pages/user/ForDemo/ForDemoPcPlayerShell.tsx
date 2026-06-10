import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent,
} from 'react';
import { Crown, Star } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router';

import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import {
    DouyinFeedPlayer,
    type DouyinFeedVideoItem,
    type FeedNavigateDirection,
} from '@/components/douyin-feed-player';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useUserStore } from '@/stores/user';
import { buildPlayerDataFromFeedItem, buildEpisodeFromFeedItem } from '@/pages/user/ForYouPage/foryouFeedUtils';
import { navigateFromForyouToVideo } from '@/pages/user/ForYouPage/foryouNavigateToVideo';
import {
    ForYouPlayerH5CommerceDrawers,
    ForYouPlayerPcCommerceDialogs,
    ForYouPlayerPcIntroDrawer,
    useForYouPlayerShare,
} from '@/pages/user/ForYouPage/forYouPlayerOverlays';
import { FORYOU_MAX_VISIBLE_TAGS } from '@/pages/user/ForYouPage/foryouConstants';
import { formatFavoriteCountK } from '@/pages/user/VideoPage/videoPlayerUtils';
import { VideoPlayerPcEpisodeNav } from '@/pages/user/VideoPage/views/VideoPlayerPcEpisodeNav';
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
import { scrollForDemoFeedToIndex } from './forDemoFeedScroll';

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
            requestAnimationFrame(() => {
                scrollForDemoFeedToIndex(activeIndex + 1);
            });
        }
        prevListLengthRef.current = listLength;
    }, [activeIndex, listLength]);

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
        scrollForDemoFeedToIndex(activeIndex - 1);
    }, [activeIndex]);

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
                            className="for-demo-pc-player h-full w-full"
                            items={playerItems}
                            mediaBaseUrl={staticBase}
                            preloadNext
                            onIndexChange={onIndexChange}
                            showNextEpisode={hasNext}
                            onNextEpisode={handleFeedNext}
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
                    </div>
                    <div
                        className="video-player-pc-side-actions flex shrink-0 flex-col gap-4"
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
