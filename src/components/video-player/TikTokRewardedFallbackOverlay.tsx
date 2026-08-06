import { FormattedMessage } from 'react-intl';

export type TikTokRewardedFallbackOverlayProps = {
    posterUrl: string;
    onRetry: () => void;
};

/** TikTok-only retry surface, visually aligned with tv-app's locked VIP overlay. */
export function TikTokRewardedFallbackOverlay({
    posterUrl,
    onRetry,
}: TikTokRewardedFallbackOverlayProps) {
    return (
        <div className="absolute inset-0 z-[9] overflow-hidden bg-black text-white">
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
                        <FormattedMessage id="unlock_now_ad" />
                    </p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-5 min-h-12 w-full rounded-lg bg-[#ff3d5d] px-8 py-3 text-base font-semibold text-white active:opacity-85"
                    >
                        <FormattedMessage id="unlock_now" />
                    </button>
                </div>
            </div>
        </div>
    );
}
