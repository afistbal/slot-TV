import type { KeyboardEvent, MouseEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

type VideoPlayerPcUnmuteOverlayProps = {
    visible: boolean;
    onTapToUnmute: () => void;
};

/** PC 冷启动静音蒙层（`.video-player-root .xgplayer-unmute`） */
export function VideoPlayerPcUnmuteOverlay({
    visible,
    onTapToUnmute,
}: VideoPlayerPcUnmuteOverlayProps) {
    const intl = useIntl();

    if (!visible) {
        return null;
    }

    const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        onTapToUnmute();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onTapToUnmute();
        }
    };

    return (
        <div
            className="xgplayer-unmute"
            role="button"
            tabIndex={0}
            aria-label={intl.formatMessage({ id: 'video_tap_to_unmute' })}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            <span className="xgplayer-unmute-bt" aria-hidden="true">
                <FormattedMessage id="video_tap_to_unmute" />
            </span>
        </div>
    );
}
