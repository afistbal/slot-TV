import { ChevronLeft } from 'lucide-react';
import { type MouseEvent, type TouchEvent } from 'react';

import { useVideoPlayerBack } from '@/components/video-player';

function stopBubble(event: MouseEvent | TouchEvent) {
    event.stopPropagation();
}

/** For You Feed 顶栏返回（H5/PC 共用；勿用 foryou-player-h5-topbar，PC 会被 foryou-vertical 隐藏） */
export function ForDemoFeedBackTopbar() {
    const handleBack = useVideoPlayerBack();

    return (
        <div
            className="for-demo-feed-back-topbar"
            onClick={stopBubble}
            onTouchStart={stopBubble}
        >
            <button
                type="button"
                onClick={handleBack}
                className="for-demo-feed-back-topbar__btn video-player-h5-topbar-back text-white flex justify-center items-center shrink-0"
                aria-label="Back"
            >
                <ChevronLeft className="w-5 h-5" aria-hidden />
            </button>
        </div>
    );
}
