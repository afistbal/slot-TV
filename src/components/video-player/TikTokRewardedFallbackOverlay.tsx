import { FormattedMessage } from 'react-intl';

export type TikTokRewardedFallbackOverlayProps = {
    posterUrl: string;
    onRetry: () => void;
    episodeOrderBlocked?: boolean;
};

/** TikTok-only retry surface, visually aligned with tv-app's locked VIP overlay. */
export function TikTokRewardedFallbackOverlay({
    posterUrl,
    onRetry,
    episodeOrderBlocked = false,
}: TikTokRewardedFallbackOverlayProps) {
    return (
        <div className="pointer-events-none absolute inset-0 z-[9] overflow-hidden bg-black text-white">
            {posterUrl ? (
                <img
                    src={posterUrl}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover blur-[16px]"
                    draggable={false}
                />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="absolute inset-0 flex items-center justify-center px-6">
                <div className="flex w-full max-w-[330px] flex-col items-center text-center">
                    <p className="max-w-[260px] text-xl font-medium leading-7 text-white">
                        <FormattedMessage
                            id={
                                episodeOrderBlocked
                                    ? 'watch_unlock_video_miss_tips'
                                    : 'unlock_now_ad'
                            }
                        />
                    </p>
                    {!episodeOrderBlocked ? (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="pointer-events-auto mt-5 min-h-12 w-full rounded-lg bg-[#ff3d5d] px-8 py-3 text-base font-semibold text-white active:opacity-85"
                        >
                            <FormattedMessage id="unlock_now" />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
