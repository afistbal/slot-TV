import { useState } from 'react';
import { ChevronLeft, Play, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { unlockTikTokEpisodeWithRewardedAd } from '@/lib/tiktokRewardedEpisodeUnlock';
import type { IPlayerEpisode } from '@/types/videoPlayer';

export type TikTokRewardedAdPageProps = {
    layout?: 'page' | 'embed';
    onEmbedClose?: () => void;
    embedVideoEpisodeRowId?: number;
    onEmbedRewardSuccessEpisodeDetail?: (episode: IPlayerEpisode) => void;
};

type RewardState = 'idle' | 'showing' | 'success' | 'failed';

/**
 * TikTok IAA-only unlock surface. The former TikTok IAP page remains in the
 * repository behind VITE_TIKTOK_MONETIZATION_MODE=iap for a possible relaunch.
 */
export default function TikTokRewardedAdPage({
    layout = 'page',
    onEmbedClose,
    embedVideoEpisodeRowId,
    onEmbedRewardSuccessEpisodeDetail,
}: TikTokRewardedAdPageProps) {
    const navigate = useNavigate();
    const [state, setState] = useState<RewardState>('idle');
    const [message, setMessage] = useState('');
    const episodeId = Number(embedVideoEpisodeRowId);
    const canUnlockEpisode = Number.isFinite(episodeId) && episodeId > 0;

    function close() {
        if (onEmbedClose) {
            onEmbedClose();
            return;
        }
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/');
    }

    async function handleWatchAd() {
        if (!canUnlockEpisode || state === 'showing') return;
        setState('showing');
        setMessage('');

        try {
            const result = await unlockTikTokEpisodeWithRewardedAd(episodeId);
            onEmbedRewardSuccessEpisodeDetail?.(result.episode);
            setState('success');
            setMessage('Episode unlocked.');
            window.setTimeout(close, 500);
        } catch (error: unknown) {
            setState('failed');
            setMessage(error instanceof Error ? error.message : 'Unable to show the ad.');
        }
    }

    const busy = state === 'showing';

    return (
        <main className="relative flex min-h-[320px] w-full flex-col bg-[#111] px-5 py-6 text-white">
            <button
                type="button"
                onClick={close}
                className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Close"
            >
                {layout === 'embed' ? <X className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>

            <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/15 text-pink-400">
                    <Play className="ml-1 h-8 w-8 fill-current" aria-hidden />
                </div>
                <h1 className="text-xl font-semibold">
                    {canUnlockEpisode ? 'Watch an ad to continue' : 'Ad-supported viewing'}
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/65">
                    {canUnlockEpisode
                        ? 'Watch the complete rewarded video to unlock this episode.'
                        : 'Open a locked episode and watch a rewarded video to continue.'}
                </p>

                {canUnlockEpisode ? (
                    <button
                        type="button"
                        onClick={() => void handleWatchAd()}
                        disabled={busy || state === 'success'}
                        className="mt-8 w-full rounded-full bg-pink-500 px-5 py-3.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {state === 'showing'
                            ? 'Loading ad...'
                            : state === 'success'
                                ? 'Unlocked'
                                : 'Watch ad'}
                    </button>
                ) : null}

                {message ? (
                    <p
                        className={`mt-4 text-sm ${state === 'failed' ? 'text-red-400' : 'text-white/70'}`}
                        role="status"
                    >
                        {message}
                    </p>
                ) : null}
            </div>
        </main>
    );
}
