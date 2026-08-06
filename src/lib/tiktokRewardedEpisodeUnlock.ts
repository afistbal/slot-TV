import { api } from '@/api';
import { isEpisodeDetailLocked } from '@/components/video-player/videoPlayerUtils';
import { initializeTikTokAds } from '@/lib/tiktokAds';
import { getTikTokRewardedAdUnitId } from '@/lib/tiktokMonetization';
import { getPlatform, isTikTokPlatform, type PlatformRewardedAdResult } from '@/platform';
import type { IPlayerEpisode } from '@/types/videoPlayer';

export type TikTokRewardedUnlockPhase = 'start' | 'ad' | 'complete';

export class TikTokRewardedUnlockError extends Error {
    readonly phase: TikTokRewardedUnlockPhase;
    readonly debugData: unknown;

    constructor(
        message: string,
        phase: TikTokRewardedUnlockPhase,
        debugData: unknown,
    ) {
        super(message);
        this.name = 'TikTokRewardedUnlockError';
        this.phase = phase;
        this.debugData = debugData;
    }
}

export type TikTokRewardedUnlockSession = {
    requestId: string;
    episodeId: number;
    adId: string;
    unlockToken: string;
    expiresAt: number;
};

export type TikTokRewardedUnlockResult = {
    episode: IPlayerEpisode;
    adResult: PlatformRewardedAdResult;
    completeResult: {
        c: number;
        m: string;
        d: IPlayerEpisode;
    };
};

type TikTokAdStartResponse = {
    request_id: string;
    episode_id: number;
    ad_id: string;
    unlock_token: string;
    expires_at: number;
};

const sessionPromises = new Map<string, Promise<TikTokRewardedUnlockSession>>();
const watchedUnlockTokens = new Set<string>();

function sessionKey(episodeId: number, adId: string): string {
    return `${episodeId}:${adId}`;
}

function sessionIsUsable(session: TikTokRewardedUnlockSession): boolean {
    return session.expiresAt > Math.floor(Date.now() / 1000) + 5;
}

function startError(message: string, debugData: unknown): TikTokRewardedUnlockError {
    return new TikTokRewardedUnlockError(message, 'start', debugData);
}

/**
 * Starts (or reuses) the short-lived server unlock session before the locked
 * TikTok episode becomes active. This function is safe to call repeatedly
 * while a swipe is in progress.
 */
export async function prepareTikTokRewardedEpisodeUnlock(
    episodeId: number,
): Promise<TikTokRewardedUnlockSession> {
    if (!isTikTokPlatform()) {
        throw startError('TikTok ad unlock is unavailable on this platform.', { episodeId });
    }
    if (!Number.isFinite(episodeId) || episodeId <= 0) {
        throw startError('TikTok ad unlock requires a valid episode ID.', { episodeId });
    }

    await initializeTikTokAds();
    const adId = getTikTokRewardedAdUnitId();
    if (!adId) {
        throw startError('TikTok rewarded ad placement is not configured.', { episodeId });
    }

    const key = sessionKey(episodeId, adId);
    const existingPromise = sessionPromises.get(key);
    if (existingPromise) {
        const existing = await existingPromise;
        if (sessionIsUsable(existing)) return existing;
        sessionPromises.delete(key);
        watchedUnlockTokens.delete(existing.unlockToken);
    }

    const startPromise = (async () => {
        const result = await api<TikTokAdStartResponse>('movie/episode/tiktok-ad/start', {
            method: 'post',
            data: {
                episode_id: episodeId,
                ad_id: adId,
            },
            loading: false,
            toastOnError: false,
        });

        const data = result.d;
        if (
            result.c !== 0
            || !data
            || !data.request_id
            || !data.ad_id
            || !data.unlock_token
            || !Number(data.expires_at)
        ) {
            throw startError(result.m || 'Unable to prepare TikTok ad unlock.', result);
        }

        return {
            requestId: String(data.request_id),
            episodeId: Number(data.episode_id || episodeId),
            adId: String(data.ad_id),
            unlockToken: String(data.unlock_token),
            expiresAt: Number(data.expires_at),
        };
    })();

    sessionPromises.set(key, startPromise);
    try {
        return await startPromise;
    } catch (error) {
        sessionPromises.delete(key);
        throw error;
    }
}

/** Uses a prewarmed start session, shows the TikTok ad, then completes unlock. */
export async function unlockTikTokEpisodeWithRewardedAd(
    episodeId: number,
): Promise<TikTokRewardedUnlockResult> {
    const session = await prepareTikTokRewardedEpisodeUnlock(episodeId);
    const showRewarded = getPlatform().ads.showRewarded;
    if (!showRewarded) {
        throw new TikTokRewardedUnlockError(
            'TikTok rewarded ads are unavailable in this environment.',
            'ad',
            { adId: session.adId, platform: getPlatform().kind },
        );
    }

    let adResult: PlatformRewardedAdResult = { isEnded: true };
    if (!watchedUnlockTokens.has(session.unlockToken)) {
        try {
            adResult = await showRewarded(session.adId);
        } catch (error) {
            throw new TikTokRewardedUnlockError(
                error instanceof Error ? error.message : 'Unable to show the rewarded ad.',
                'ad',
                error,
            );
        }

        if (!adResult.isEnded) {
            throw new TikTokRewardedUnlockError(
                'Watch the full ad to unlock this episode.',
                'ad',
                adResult,
            );
        }
        watchedUnlockTokens.add(session.unlockToken);
    }

    let completeResult;
    try {
        completeResult = await api<IPlayerEpisode>('movie/episode/tiktok-ad/complete', {
            method: 'post',
            data: {
                episode_id: episodeId,
                ad_id: session.adId,
                unlock_token: session.unlockToken,
            },
            loading: false,
            toastOnError: false,
        });
    } catch (error) {
        throw new TikTokRewardedUnlockError(
            error instanceof Error ? error.message : 'Unable to complete TikTok ad unlock.',
            'complete',
            { session, error },
        );
    }

    if (completeResult.c !== 0 || !completeResult.d) {
        throw new TikTokRewardedUnlockError(
            completeResult.m || 'Unable to complete TikTok ad unlock.',
            'complete',
            { session, completeResult },
        );
    }
    if (isEpisodeDetailLocked(completeResult.d.lock)) {
        throw new TikTokRewardedUnlockError(
            'The server did not unlock this episode.',
            'complete',
            { session, completeResult },
        );
    }

    sessionPromises.delete(sessionKey(episodeId, session.adId));
    watchedUnlockTokens.delete(session.unlockToken);
    return { episode: completeResult.d, adResult, completeResult };
}
