import { Check, X } from 'lucide-react';
import type { RefObject } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import lockIcon from '@/assets/lock.svg';
import Image from '@/components/Image';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { formatVideoIntroTagLabel, videoIntroTagSearchPath } from '@/lib/videoIntroTagSearch';
import { cn } from '@/lib/utils';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { SPEED } from '../videoPlayerConstants';

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
    onIntroductionOpenChange: () => void;
    onCloseIntroductionLinks: () => void;
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
}: Props) {
    return (
        <>
            <Drawer open={episodeStatus} onOpenChange={() => onToggleEpisodeDrawer()}>
                <DrawerContent className="bg-slate-800" aria-describedby="Episode">
                    <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                        <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                            {data.info.title}
                        </div>
                        <div onClick={onToggleEpisodeDrawer}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <DrawerDescription className="text-slate-300 px-4 text-sm pt-1 line-clamp-2 overflow-hidden text-ellipsis">
                        <FormattedMessage id="episode" /> {episode?.episode} / {data.episodes.length}
                    </DrawerDescription>
                    <div className="border-t border-slate-700 mt-4" />
                    <div
                        className="gap-2 p-4 text-white h-[45vh] overflow-auto grid grid-cols-6"
                        ref={episodeRef}
                    >
                        {data.episodes.map((v, k) => (
                            <div
                                data-episode={v.episode}
                                onClick={() => onSelectEpisodeIndex(k)}
                                key={v.id}
                                className={cn(
                                    'bg-slate-600 rounded-md relative pb-[100%]',
                                    v.episode === episode?.episode && 'bg-red-400',
                                )}
                            >
                                <div className="font-bold absolute w-full h-full flex justify-center items-center">
                                    {k + 1}
                                </div>
                                {v.vip !== 0 && v.locked === 1 && !viewerIsVip && (
                                    <div className="absolute text-white top-1 right-1">
                                        <img src={lockIcon} alt="" className="w-3 h-3" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="h-4" />
                </DrawerContent>
            </Drawer>
            <Drawer open={speedOpen} onOpenChange={onSpeedDrawerOpenChange}>
                <DrawerContent className="bg-slate-800" aria-describedby="PlaybackSpeed">
                    <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                        <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                            <FormattedMessage id="playback_speed" />
                        </div>
                        <div onClick={() => onSpeedDrawerOpenChange()}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="border-t border-slate-700 mt-4" />
                    <div className="flex flex-col gap-2 p-4 text-white">
                        {SPEED.map((v, k) => (
                            <div
                                key={k}
                                className="py-2 flex justify-between"
                                onClick={() => onSelectSpeed(k)}
                            >
                                <div>{v.toFixed(2)} x</div>
                                <div
                                    className={cn(
                                        'rounded-full w-6 h-6 flex justify-center items-center',
                                        speed === k ? 'bg-red-400' : 'bg-slate-50/10',
                                    )}
                                >
                                    {speed === k && <Check className="w-4 h-4" />}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="h-4" />
                </DrawerContent>
            </Drawer>
            <Drawer open={introduction} onOpenChange={onIntroductionOpenChange}>
                <DrawerContent className="bg-slate-800 video-intro-drawer" aria-describedby="Introduction">
                    <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                        <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                            <FormattedMessage id="introduction" />
                        </div>
                        <div onClick={onIntroductionOpenChange}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="border-t border-slate-700 mt-4" />
                    <div className="flex flex-col gap-4 p-4 text-white">
                        <div className="flex gap-4">
                            <div className="w-28 shrink-0">
                                <Image
                                    height={1.3325}
                                    src={`${staticBase}/${data.info.image}`}
                                    alt={data.info.title}
                                />
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="font-bold line-clamp-2 overflow-ellipsis text-slate-300">
                                    {data.info.title}
                                </div>
                                <div className="text-sm text-slate-400 mb-1">
                                    <FormattedMessage id="episode" />: {episodeIndex + 1} /{' '}
                                    {data.episodes.length}
                                </div>
                                <div className="flex gap-1 flex-wrap text-sm ">
                                    {data.tags.map((v) => (
                                        <Link
                                            key={v.name}
                                            to={videoIntroTagSearchPath(v)}
                                            onClick={() => onCloseIntroductionLinks()}
                                            className="bg-slate-600 px-2 py-1 rounded-sm text-slate-300 active:opacity-80"
                                        >
                                            {formatVideoIntroTagLabel(v.unique_id)}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="text-md text-slate-300">{data.info.introduction}</div>
                    </div>
                    <div className="h-4" />
                </DrawerContent>
            </Drawer>
        </>
    );
}
