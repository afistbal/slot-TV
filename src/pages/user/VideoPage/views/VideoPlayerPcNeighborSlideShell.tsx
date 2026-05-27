import { Crown, LayoutGrid, Star } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import { VideoPlayerPcBackBar } from './VideoPlayerPcBackBar';
import type { IPlayerData } from '@/types/videoPlayer';
import { canNavigateBack } from '../videoPlayerUtils';

export type VideoPlayerPcNeighborSlideShellProps = {
    data: IPlayerData;
    viewerIsVip: boolean;
};

/** PC 竖滑邻格：与当前集 VideoPlayer 同构（左黑底 9:16 + 右操作栏），不挂 VideoPlayer / 剧封 / 集数文案 */
export function VideoPlayerPcNeighborSlideShell({ data, viewerIsVip }: VideoPlayerPcNeighborSlideShellProps) {
    const intl = useIntl();
    const navigate = useNavigate();

    const handleBack = () => {
        if (canNavigateBack()) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="video-vertical-pc-neighbor-shell absolute inset-0 z-[1] flex bg-black">
            <div className="video-player-pc-shell relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
                <div className="video-player-pc-stage-cluster flex h-full max-h-full flex-row items-center justify-center">
                    <div className="relative aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden bg-black" />
                    <div
                        className="video-player-pc-side-actions flex shrink-0 flex-col gap-4"
                        data-vertical-swipe-ignore
                    >
                        {!viewerIsVip && (
                            <div className="flex flex-col items-center gap-1">
                                <Crown className="h-8 w-8 fill-[#ffd000] text-[#ffd000]" />
                                <div className="h-4 text-center text-xs leading-4 text-[#ffd000]">
                                    <FormattedMessage id="shopping_vip_fab_label" />
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col items-center gap-1">
                            <Star className="h-8 w-8 fill-white text-white" />
                            <div className="h-4 text-center text-xs leading-4 text-white">
                                {data.info.favorite}K
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <LayoutGrid className="h-8 w-8 fill-white text-white" />
                            <div className="h-4 text-center text-xs leading-4 text-white">
                                <FormattedMessage id="episode_list" />
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <img src={shareEntryIcon} alt="" className="h-8 w-8" />
                            <div className="h-4 text-center text-xs leading-4 text-white">
                                {intl.formatMessage({ id: 'share' })}
                            </div>
                        </div>
                    </div>
                </div>
                <VideoPlayerPcBackBar onBack={handleBack} />
            </div>
        </div>
    );
}
