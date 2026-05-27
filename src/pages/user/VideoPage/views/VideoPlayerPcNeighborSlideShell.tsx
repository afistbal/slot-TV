import { useNavigate } from 'react-router';
import pcBackIcon from '@/assets/icons/video-pc-back.svg';
import type { IPlayerData } from '@/types/videoPlayer';
import { canNavigateBack } from '../videoPlayerUtils';

export type VideoPlayerPcNeighborSlideShellProps = {
    data: IPlayerData;
    listIndex: number;
    viewerIsVip: boolean;
    onSetEpisode: (listIndex: number) => void;
};

/** PC 竖滑邻格：居中黑底 + 返回（不挂 VideoPlayer；侧栏/抽屉仅当前激活集展示） */
export function VideoPlayerPcNeighborSlideShell({
    data,
    listIndex,
}: VideoPlayerPcNeighborSlideShellProps) {
    const navigate = useNavigate();
    const episodeNo = data.episodes[listIndex]?.episode ?? listIndex + 1;

    const handleBack = () => {
        if (canNavigateBack()) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="video-vertical-pc-neighbor-shell absolute inset-0 z-[1] flex items-center justify-center bg-black">
            <button
                type="button"
                className="video-player-pc-close-btn flex items-center gap-2 border-0 p-0"
                onClick={handleBack}
                aria-label="back"
            >
                <img src={pcBackIcon} alt="" className="h-6 w-6" />
                <span className="text-[16px] font-bold text-white">EP.{episodeNo}</span>
            </button>
        </div>
    );
}
