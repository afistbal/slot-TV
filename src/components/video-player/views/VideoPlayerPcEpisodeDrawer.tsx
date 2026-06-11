import activeEpisodeBadgeGif from '@/assets/images/f24458e0-c6ae-11f0-84ad-6b5693b490dc.gif';
import episodeLockBadgeIcon from '@/assets/icons/episode-lock-badge.svg';
import { cn } from '@/lib/utils';
import type { IPlayerData } from '@/types/videoPlayer';
import type { RefObject } from 'react';
import type { EpisodeTabRange } from '../videoPlayerPcEpisodeTabs';
import { VideoPlayerPcDrawerCloseButton } from './VideoPlayerPcDrawerCloseButton';
import { VideoPlayerPcRightDrawer } from './VideoPlayerPcRightDrawer';

export type VideoPlayerPcEpisodeDrawerProps = {
    open: boolean;
    entered: boolean;
    onClose: () => void;
    anchorRef: RefObject<HTMLElement | null>;
    currentEpisodeNo: number;
    data: IPlayerData;
    viewerIsVip: boolean;
    tabRanges: EpisodeTabRange[];
    activeTab: number;
    onSelectEpisodeTab: (tabIndex: number) => void;
    filteredEpisodes: IPlayerData['episodes'];
    onSelectEpisodeByListIndex: (listIndex: number) => void;
    /** 分集格锁角标；未传则沿用 info 列表 vip/locked */
    resolveEpisodeCellLocked?: (row: IPlayerData['episodes'][number]) => boolean;
};

export function VideoPlayerPcEpisodeDrawer({
    open,
    entered,
    onClose,
    anchorRef,
    currentEpisodeNo,
    data,
    viewerIsVip,
    tabRanges,
    activeTab,
    onSelectEpisodeTab,
    filteredEpisodes,
    onSelectEpisodeByListIndex,
    resolveEpisodeCellLocked,
}: VideoPlayerPcEpisodeDrawerProps) {
    return (
        <VideoPlayerPcRightDrawer
            open={open}
            entered={entered}
            onClose={onClose}
            anchorRef={anchorRef}
            ariaLabel="Episodes"
            className="video-pc-right-drawer--episode"
            showPanelClose={false}
        >
            <div className="video-pc-episode-drawer__scroll">
                <div className="video-pc-episode-drawer__header">
                    <div className="video-pc-episode-drawer__tabs">
                    {tabRanges.map((r, idx) => (
                        <button
                            type="button"
                            key={`${r.start}-${r.end}`}
                            className={cn(
                                'video-pc-episode-drawer__tab',
                                idx === activeTab && 'video-pc-episode-drawer__tab--active',
                            )}
                            onClick={() => onSelectEpisodeTab(idx)}
                        >
                            {r.start} - {r.end}
                            {idx === activeTab && (
                                <span className="video-pc-episode-drawer__tab-indicator" />
                            )}
                        </button>
                    ))}
                    </div>
                    <VideoPlayerPcDrawerCloseButton onClose={onClose} tabIndex={open ? 0 : -1} />
                </div>
                <div className="video-pc-episode-drawer__grid">
                    {filteredEpisodes.map((v) => {
                        const rawIndex = data.episodes.findIndex((e) => e.id === v.id);
                        const locked = resolveEpisodeCellLocked
                            ? resolveEpisodeCellLocked(v)
                            : !viewerIsVip && v.vip !== 0 && v.locked === 1;
                        return (
                            <button
                                type="button"
                                key={v.id}
                                onClick={() => onSelectEpisodeByListIndex(rawIndex)}
                                className={cn(
                                    'video-pc-episode-btn',
                                    v.episode === currentEpisodeNo && 'video-pc-episode-btn--active',
                                )}
                            >
                                {v.episode}
                                {v.episode === currentEpisodeNo && (
                                    <div className="video-pc-episode-btn__playing-badge">
                                        <img alt="" src={activeEpisodeBadgeGif} />
                                    </div>
                                )}
                                {locked && (
                                    <div className="video-pc-episode-btn__lock-badge">
                                        <img src={episodeLockBadgeIcon} alt="" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </VideoPlayerPcRightDrawer>
    );
}
