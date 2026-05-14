import { Crown, Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import activeEpisodeBadgeGif from '@/assets/images/f24458e0-c6ae-11f0-84ad-6b5693b490dc.gif';
import episodeLockBadgeIcon from '@/assets/icons/episode-lock-badge.svg';
import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import pcFullscreenExitHandleBg from '@/assets/images/9061da60-c404-11ef-a2d6-41216ff1602c.png';
import { videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';
import { cn } from '@/lib/utils';
import type { IPlayerData } from '@/types/videoPlayer';
import { getTagDisplayText } from '../videoPlayerUtils';

export type EpisodeTabRange = { start: number; end: number };

export type VideoPlayerPcEpisodeAsideProps = {
    pcFullscreen: boolean;
    onExitPcFullscreen: () => void | Promise<void>;
    currentEpisodeNo: number;
    data: IPlayerData;
    /** 当前账号为 VIP 时，分集格不展示「未解锁」锁角标 */
    viewerIsVip: boolean;
    favorite: boolean;
    onToggleFavorite: () => void;
    onToggleVip: (e?: MouseEvent) => void;
    onOpenShare: () => void;
    tabRanges: EpisodeTabRange[];
    activeTab: number;
    onSelectEpisodeTab: (tabIndex: number) => void;
    filteredEpisodes: IPlayerData['episodes'];
    onSelectEpisodeByListIndex: (listIndex: number) => void;
};

export function VideoPlayerPcEpisodeAside({
    pcFullscreen,
    onExitPcFullscreen,
    currentEpisodeNo,
    data,
    favorite,
    onToggleFavorite,
    onToggleVip,
    onOpenShare,
    tabRanges,
    activeTab,
    onSelectEpisodeTab,
    filteredEpisodes,
    onSelectEpisodeByListIndex,
    viewerIsVip,
}: VideoPlayerPcEpisodeAsideProps) {
    const intl = useIntl();

    return (
        <aside
            data-pc-episode-aside
            className={cn(
                'w-[480px] h-full border-l border-white/20 bg-black transition-transform duration-500 ease-in-out',
                pcFullscreen ? 'translate-x-full absolute right-0 top-0' : 'translate-x-0 relative',
            )}
        >
            {pcFullscreen && (
                <div
                    className="absolute top-1/2 h-[122px] w-[34px] cursor-pointer bg-cover transition-all duration-300 -left-[34px] -translate-y-1/2"
                    style={{ backgroundImage: `url(${pcFullscreenExitHandleBg})` }}
                    onClick={() => {
                        void onExitPcFullscreen();
                    }}
                />
            )}
            <div className="h-full w-[480px] overflow-y-auto px-[30px] pb-[30px] pt-[24px]">
                <nav aria-label="Breadcrumb" className="text-white/50 flex text-[14px] leading-normal mb-[24px]">
                    <Link to="/">
                        <FormattedMessage id="home" />
                    </Link>
                    <span className="mx-2">/</span>
                    <span className="max-w-[180px] line-clamp-1 break-all text-white">
                        Episode {currentEpisodeNo}
                    </span>
                </nav>
                <h1 className="line-clamp-2 break-words text-[24px] font-bold leading-[1.2]">
                    Episode {currentEpisodeNo} - {data.info.title} Full Movie
                </h1>
                <h3 className="line-clamp-2 mt-[24px] font-normal text-[18px]">
                    Plot of Episode {currentEpisodeNo}
                </h3>
                <div className="mt-[8px] break-words text-[14px] text-white/50 leading-[1.5] line-clamp-3">
                    {data.info.introduction}
                </div>
                <div className="flex flex-wrap overflow-hidden max-h-none mt-[16px]">
                    {data.tags.map((v) => (
                        <Link
                            key={v.name}
                            to={videoIntroTagSearchPath(v)}
                            className="mr-[10px] mb-[10px] inline-flex max-h-[27px] max-w-[152px] cursor-pointer items-center break-all rounded-[3px] bg-white/10 px-[8px] text-[12px] leading-[27px] text-white/90 line-clamp-1 hover:bg-white/15"
                        >
                            {getTagDisplayText(v)}
                        </Link>
                    ))}
                </div>
                <div className="mt-[14px] h-[90px] border-t border-white/20">
                    <div className="h-full w-full grid grid-cols-3 items-center">
                        <div
                            className="flex flex-col cursor-pointer items-center text-white/90 md:text-white/70"
                            onClick={onToggleFavorite}
                        >
                            <div className="flex text-[32px]">
                                <Star
                                    className={cn(
                                        'w-8 h-8 text-white fill-white',
                                        favorite && 'fill-[#ffd000] stroke-[#ffd000]',
                                    )}
                                />
                            </div>
                            <span className="flex mt-[4px] text-[14px]">{data.info.favorite}K</span>
                        </div>
                        <div
                            className="flex flex-col cursor-pointer items-center text-white/90 md:text-white/70"
                            onClick={(e) => onToggleVip(e)}
                        >
                            <div className="flex text-[32px]">
                                <Crown className="w-8 h-8 text-[#ffd000] fill-[#ffd000]" />
                            </div>
                            <span className="flex mt-[4px] text-[14px]">VIP</span>
                        </div>
                        <div
                            className="flex flex-col cursor-pointer items-center text-white/90 md:text-white/70"
                            onClick={onOpenShare}
                        >
                            <div className="flex text-[32px]">
                                <img src={shareEntryIcon} alt="" className="w-8 h-8" />
                            </div>
                            <span className="flex mt-[4px] text-[14px]">
                                {intl.formatMessage({ id: 'share' })}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="border-t border-white/20 pt-[24px]">
                    <div className="flex text-[16px] text-white/50">
                        {tabRanges.map((r, idx) => (
                            <div
                                key={`${r.start}-${r.end}`}
                                className={cn(
                                    'min-w-[35px] text-center cursor-pointer',
                                    idx === 0 ? '' : 'ml-[25px]',
                                    idx === activeTab && 'text-[#E52E2E] relative',
                                )}
                                onClick={() => onSelectEpisodeTab(idx)}
                            >
                                {r.start} - {r.end}
                                {idx === activeTab && (
                                    <span className="absolute -bottom-[8px] left-1/2 -ml-[10px] w-[20px] h-[3px] bg-[#E52E2E] rounded-[2px]" />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-[23px] grid grid-cols-6 gap-[8px] overflow-hidden">
                        {filteredEpisodes.map((v) => {
                            const rawIndex = data.episodes.findIndex((e) => e.id === v.id);
                            const locked = !viewerIsVip && v.vip !== 0 && v.locked === 1;
                            return (
                                <div
                                    key={v.id}
                                    onClick={() => onSelectEpisodeByListIndex(rawIndex)}
                                    className={cn(
                                        'video-pc-episode-btn flex items-center justify-center w-full h-[46px] bg-white/10 text-[16px] text-white/90 rounded-[4px] cursor-pointer relative',
                                        v.episode === currentEpisodeNo &&
                                            'video-pc-episode-btn--active text-[14px] text-white/50 font-medium',
                                    )}
                                >
                                    {v.episode}
                                    {v.episode === currentEpisodeNo && (
                                        <div className="absolute right-[2px] bottom-[2px] flex w-[12px] h-[12px]">
                                            <img
                                                alt=""
                                                src={activeEpisodeBadgeGif}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    {locked && (
                                        <div className="absolute right-0 top-0 w-4 h-3 bg-[#e52e2e] rounded-[0_6px_0_6px] flex items-center justify-center">
                                            <img src={episodeLockBadgeIcon} alt="" className="w-2.5 h-2.5" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </aside>
    );
}
