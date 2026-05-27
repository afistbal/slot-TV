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
                    <div className="video-pc-episode-drawer__tabs flex text-[16px] text-white/50">
                    {tabRanges.map((r, idx) => (
                        <button
                            type="button"
                            key={`${r.start}-${r.end}`}
                            className={cn(
                                'min-w-[35px] cursor-pointer border-0 bg-transparent p-0 text-center',
                                idx === 0 ? '' : 'ml-[25px]',
                                idx === activeTab ? 'relative text-[#E52E2E]' : 'text-white/50',
                            )}
                            onClick={() => onSelectEpisodeTab(idx)}
                        >
                            {r.start} - {r.end}
                            {idx === activeTab && (
                                <span className="absolute -bottom-[8px] left-1/2 -ml-[10px] h-[3px] w-[20px] rounded-[2px] bg-[#E52E2E]" />
                            )}
                        </button>
                    ))}
                    </div>
                    <VideoPlayerPcDrawerCloseButton onClose={onClose} tabIndex={open ? 0 : -1} />
                </div>
                <div className="grid grid-cols-6 gap-[8px]">
                    {filteredEpisodes.map((v) => {
                        const rawIndex = data.episodes.findIndex((e) => e.id === v.id);
                        const locked = !viewerIsVip && v.vip !== 0 && v.locked === 1;
                        return (
                            <button
                                type="button"
                                key={v.id}
                                onClick={() => {
                                    onSelectEpisodeByListIndex(rawIndex);
                                    onClose();
                                }}
                                className={cn(
                                    'video-pc-episode-btn relative flex h-[46px] w-full cursor-pointer items-center justify-center rounded-[4px] border-0 bg-white/10 text-[16px] text-white/90',
                                    v.episode === currentEpisodeNo &&
                                        'video-pc-episode-btn--active text-[14px] font-medium text-white/50',
                                )}
                            >
                                {v.episode}
                                {v.episode === currentEpisodeNo && (
                                    <div className="absolute bottom-[2px] right-[2px] flex h-[12px] w-[12px]">
                                        <img
                                            alt=""
                                            src={activeEpisodeBadgeGif}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                )}
                                {locked && (
                                    <div className="absolute right-0 top-0 flex h-3 w-4 items-center justify-center rounded-[0_6px_0_6px] bg-[#e52e2e]">
                                        <img src={episodeLockBadgeIcon} alt="" className="h-2.5 w-2.5" />
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
