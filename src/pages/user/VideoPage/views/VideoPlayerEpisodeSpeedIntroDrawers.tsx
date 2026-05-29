import { X } from 'lucide-react';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import episodeLockBadgeIcon from '@/assets/icons/episode-lock-badge.svg';
import activeEpisodeBadgeGif from '@/assets/images/f24458e0-c6ae-11f0-84ad-6b5693b490dc.gif';
import Image from '@/components/Image';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { getBackendTagDisplayText } from '@/lib/normalizePlayerTags';
import { useMovieTagLabelsReady } from '@/lib/movieTagLabels';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';
import { cn } from '@/lib/utils';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { resolveVideoPosterUrl } from '../videoPlayerShareUrl';
import { getTagDisplayText } from '../videoPlayerUtils';
import { SPEED } from '../videoPlayerConstants';
import {
    buildEpisodeTabRanges,
    episodeTabIndexForEpisodeNo,
    H5_EPISODE_TAB_PAGE_SIZE,
} from '../videoPlayerPcEpisodeTabs';

function formatPlaybackSpeedLabel(rate: number) {
    if (Number.isInteger(rate)) {
        return `${rate.toFixed(1)}x`;
    }
    return `${rate.toFixed(2).replace(/(\.\d)0$/, '$1')}x`;
}

type Props = {
    data: IPlayerData;
    episodeIndex: number;
    staticBase: string;
    /** 当前账号为 VIP 时，分集抽屉内不展示锁角标 */
    viewerIsVip: boolean;
    episodeStatus: boolean;
    onToggleEpisodeDrawer: () => void;
    episode: IPlayerEpisode | undefined;
    episodeRef: RefObject<HTMLDivElement | null>;
    onSelectEpisodeIndex: (k: number) => void;
    speedOpen: boolean;
    onSpeedDrawerOpenChange: (open?: boolean) => void;
    speed: number;
    onSelectSpeed: (k: number) => void;
    introduction: boolean;
    onIntroductionOpenChange: (open?: boolean) => void;
    onCloseIntroductionLinks: () => void;
    /** PC 使用独立右侧抽屉，不渲染 H5 分集/简介底栏 */
    hideEpisodeDrawer?: boolean;
    hideIntroDrawer?: boolean;
    /** For You：仅用接口 tags 字段，不走 tag-labels */
    tagsFromBackendOnly?: boolean;
};

export function VideoPlayerEpisodeSpeedIntroDrawers({
    data,
    episodeIndex,
    staticBase,
    viewerIsVip,
    episodeStatus,
    onToggleEpisodeDrawer,
    episode,
    episodeRef,
    onSelectEpisodeIndex,
    speedOpen,
    onSpeedDrawerOpenChange,
    speed,
    onSelectSpeed,
    introduction,
    onIntroductionOpenChange,
    onCloseIntroductionLinks,
    hideEpisodeDrawer = false,
    hideIntroDrawer = false,
    tagsFromBackendOnly = false,
}: Props) {
    const tagLabel = tagsFromBackendOnly ? getBackendTagDisplayText : getTagDisplayText;
    useMovieTagLabelsReady();
    const episodeCount = data.episodes.length;
    const currentEpisodeNo = episode?.episode ?? episodeIndex + 1;
    const episodeTabRanges = useMemo(
        () => buildEpisodeTabRanges(episodeCount, H5_EPISODE_TAB_PAGE_SIZE),
        [episodeCount],
    );
    const [activeEpisodeTab, setActiveEpisodeTab] = useState(0);

    useEffect(() => {
        if (!episodeStatus) {
            return;
        }
        const nextTab = episodeTabIndexForEpisodeNo(currentEpisodeNo, episodeTabRanges);
        setActiveEpisodeTab((prev) => (prev === nextTab ? prev : nextTab));
    }, [episodeStatus, currentEpisodeNo, episodeTabRanges]);

    const visibleEpisodes = useMemo(() => {
        const range = episodeTabRanges[activeEpisodeTab];
        if (!range) {
            return data.episodes;
        }
        return data.episodes.filter((e) => e.episode >= range.start && e.episode <= range.end);
    }, [data.episodes, episodeTabRanges, activeEpisodeTab]);

    return (
        <>
            {!hideEpisodeDrawer ? (
                <Drawer open={episodeStatus} onOpenChange={() => onToggleEpisodeDrawer()}>
                    <DrawerContent
                        className="video-h5-drawer video-h5-drawer--episode"
                        aria-describedby="video-h5-episode-grid"
                    >
                        <DrawerTitle className="video-h5-drawer__title video-h5-drawer__title--episode">
                            <div className="video-h5-drawer__titleText">
                                <FormattedMessage id="episode" />
                            </div>
                            <div
                                className="video-h5-drawer__close"
                                role="button"
                                tabIndex={0}
                                onClick={onToggleEpisodeDrawer}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onToggleEpisodeDrawer();
                                    }
                                }}
                            >
                                <X aria-hidden />
                            </div>
                        </DrawerTitle>
                        {episodeTabRanges.length > 1 ? (
                            <div className="video-h5-drawer__episodeTabs" role="tablist">
                                {episodeTabRanges.map((r, idx) => (
                                    <button
                                        key={`${r.start}-${r.end}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={idx === activeEpisodeTab}
                                        className={cn(
                                            'video-h5-drawer__episodeTab',
                                            idx === activeEpisodeTab &&
                                                'video-h5-drawer__episodeTab--active',
                                        )}
                                        onClick={() => setActiveEpisodeTab(idx)}
                                    >
                                        {r.start}-{r.end}
                                        {idx === activeEpisodeTab ? (
                                            <span
                                                className="video-h5-drawer__episodeTabIndicator"
                                                aria-hidden
                                            />
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        <div
                            id="video-h5-episode-grid"
                            className="video-h5-drawer__episodeGrid"
                            ref={episodeRef}
                        >
                            {visibleEpisodes.map((v) => {
                                const listIndex = data.episodes.findIndex((e) => e.id === v.id);
                                const isCurrent = v.episode === currentEpisodeNo;
                                const locked =
                                    !viewerIsVip && v.vip !== 0 && v.locked === 1;
                                return (
                                    <div
                                        data-episode={v.episode}
                                        onClick={() => onSelectEpisodeIndex(listIndex)}
                                        key={v.id}
                                        className={cn(
                                            'video-h5-drawer__episodeCell',
                                            isCurrent && 'video-h5-drawer__episodeCell--active',
                                        )}
                                    >
                                        <div className="video-h5-drawer__episodeNum">
                                            {v.episode}
                                        </div>
                                        {isCurrent ? (
                                            <div className="video-h5-drawer__episodePlaying">
                                                <img src={activeEpisodeBadgeGif} alt="" />
                                            </div>
                                        ) : null}
                                        {locked ? (
                                            <div className="video-h5-drawer__episodeLock">
                                                <img src={episodeLockBadgeIcon} alt="" />
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                        <div
                            className="video-h5-drawer__footer video-h5-drawer__footer--episode"
                            aria-hidden
                        />
                    </DrawerContent>
                </Drawer>
            ) : null}
            <Drawer open={speedOpen} onOpenChange={onSpeedDrawerOpenChange}>
                <DrawerContent
                    className="video-h5-drawer video-h5-drawer--speed"
                    aria-describedby="PlaybackSpeed"
                >
                    <DrawerTitle className="video-h5-drawer__title">
                        <div className="video-h5-drawer__titleText">
                            <FormattedMessage id="playback_speed" />
                        </div>
                        <div
                            className="video-h5-drawer__close"
                            role="button"
                            tabIndex={0}
                            onClick={() => onSpeedDrawerOpenChange()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    onSpeedDrawerOpenChange();
                                }
                            }}
                        >
                            <X aria-hidden />
                        </div>
                    </DrawerTitle>
                    <div className="video-h5-drawer__speedList">
                        {SPEED.map((v, k) => (
                            <button
                                key={k}
                                type="button"
                                className={cn(
                                    'video-h5-drawer__speedRow',
                                    speed === k && 'video-h5-drawer__speedRow--active',
                                )}
                                onClick={() => onSelectSpeed(k)}
                            >
                                {formatPlaybackSpeedLabel(v)}
                            </button>
                        ))}
                    </div>
                    <div className="video-h5-drawer__footer video-h5-drawer__footer--speed" aria-hidden />
                </DrawerContent>
            </Drawer>
            {!hideIntroDrawer ? (
                <Drawer open={introduction} onOpenChange={onIntroductionOpenChange}>
                    <DrawerContent
                        className="video-h5-drawer video-h5-drawer--intro video-intro-drawer"
                        aria-describedby="video-h5-intro-desc"
                    >
                        <DrawerTitle className="sr-only">
                            <FormattedMessage id="introduction" />
                        </DrawerTitle>
                        <div className="video-h5-drawer__introBody">
                            <div className="video-h5-drawer__introTop">
                                <div className="video-h5-drawer__introPoster">
                                    <Image
                                        height={1.3325}
                                        src={resolveVideoPosterUrl(staticBase, data.info, data.info.id)}
                                        alt={data.info.title}
                                    />
                                </div>
                                <div
                                    className="video-h5-drawer__close"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onIntroductionOpenChange(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onIntroductionOpenChange(false);
                                        }
                                    }}
                                >
                                    <X aria-hidden />
                                </div>
                            </div>
                            <h3 className="video-h5-drawer__introTitle">{data.info.title}</h3>
                            <p id="video-h5-intro-desc" className="video-h5-drawer__introText">
                                {data.info.introduction ? (
                                    data.info.introduction
                                ) : (
                                    <FormattedMessage id="no_introduction_available" />
                                )}
                            </p>
                            {data.tags.length > 0 ? (
                                <div className="video-h5-drawer__introTags">
                                    {data.tags.map((v) => (
                                        <Link
                                            key={v.unique_id}
                                            to={videoIntroTagSearchPath(v)}
                                            onClick={() => onCloseIntroductionLinks()}
                                            className="video-h5-drawer__introTag"
                                        >
                                            {tagLabel(v)}
                                        </Link>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div
                            className="video-h5-drawer__footer video-h5-drawer__footer--intro"
                            aria-hidden
                        />
                    </DrawerContent>
                </Drawer>
            ) : null}
        </>
    );
}
