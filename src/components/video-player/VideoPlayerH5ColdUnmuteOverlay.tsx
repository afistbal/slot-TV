import { FormattedMessage, useIntl } from 'react-intl';

type VideoPlayerH5ColdUnmuteOverlayProps = {
    visible: boolean;
    onTapToUnmute: () => void;
};

/** H5 冷启动静音蒙层（全屏半透明 + 圆角按钮） */
export function VideoPlayerH5ColdUnmuteOverlay({
    visible,
    onTapToUnmute,
}: VideoPlayerH5ColdUnmuteOverlayProps) {
    const intl = useIntl();

    if (!visible) {
        return null;
    }

    return (
        <button
            type="button"
            className="video-player-h5-cold-unmute-overlay absolute inset-0 z-[25] flex cursor-pointer items-center justify-center border-0 bg-black/35 px-6 p-0"
            data-vertical-swipe-ignore
            onClick={(event) => {
                event.stopPropagation();
                onTapToUnmute();
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
