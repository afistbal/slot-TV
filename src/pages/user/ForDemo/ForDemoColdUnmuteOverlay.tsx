import { FormattedMessage, useIntl } from 'react-intl';

import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';

import { useForDemoTapToUnmute } from './useForDemoTapToUnmute';

type ForDemoColdUnmuteOverlayProps = {
    /** 仅首条冷启动展示蒙层 */
    activeIndex: number;
};

export function ForDemoColdUnmuteOverlay({ activeIndex }: ForDemoColdUnmuteOverlayProps) {
    const intl = useIntl();
    const handleTapToUnmute = useForDemoTapToUnmute();
    const coldUnmuteOverlay = useForDemoColdUnmuteStore((s) => s.coldUnmuteOverlay);
    const overlayDismissed = useForDemoColdUnmuteStore((s) => s.overlayDismissed);
    const feedColdAutoplay = useForDemoColdUnmuteStore((s) => s.feedColdAutoplay);

    const visible =
        activeIndex === 0 &&
        feedColdAutoplay &&
        coldUnmuteOverlay &&
        !overlayDismissed;

    if (!visible) {
        return null;
    }

    return (
        <button
            type="button"
            className="for-demo-cold-unmute-overlay absolute inset-0 z-[25] flex cursor-pointer items-center justify-center border-0 bg-black/35 px-6 p-0"
            data-vertical-swipe-ignore
            onClick={(e) => {
                e.stopPropagation();
                handleTapToUnmute();
            }}
            aria-label={intl.formatMessage({ id: 'video_tap_to_unmute' })}
        >
            <span
                className="pointer-events-none rounded-full border border-white/15 bg-black/80 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
                aria-hidden="true"
            >
                <FormattedMessage id="video_tap_to_unmute" />
            </span>
        </button>
    );
}
