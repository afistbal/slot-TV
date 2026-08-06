import type {
    AppPlatform,
    PlatformRewardedAdResult,
    PlatformSilentLoginResult,
} from '../types';
import { isTikTokWebTestMode } from './webTest';

type TikTokLoginResponse = {
    authResponse?: {
        code?: unknown;
    };
    error?: unknown;
};

type TikTokMinisLoginSdk = {
    login: (callback: (result: TikTokLoginResponse) => void) => void;
};

type TikTokMinisPaymentSdk = TikTokMinisLoginSdk & {
    pay?: (
        callback: (result: unknown) => void,
        options: { trade_order_id: string },
    ) => unknown;
    game?: {
        pay: (
            options: { trade_order_id: string },
            callback?: (result: unknown) => void,
        ) => unknown;
    };
};

type TikTokRewardedAdCloseResult = {
    isEnded?: unknown;
};

type TikTokRewardedAd = {
    show: () => Promise<unknown>;
    onClose: (callback: (result: TikTokRewardedAdCloseResult) => void) => void;
    offClose?: (callback: (result: TikTokRewardedAdCloseResult) => void) => void;
    onError: (callback: (error?: unknown) => void) => void;
    offError?: (callback: (error?: unknown) => void) => void;
};

type TikTokMinisAdsSdk = TikTokMinisLoginSdk & {
    canIUse?: (schema: string) => boolean;
    createRewardedVideoAd?: (options: { adUnitId: string }) => TikTokRewardedAd;
};

/**
 * All direct TTMinis access is kept in this directory. Product pages import
 * `getPlatform()` instead of reading window.TTMinis themselves.
 */
function getTikTokLoginSdk(): TikTokMinisLoginSdk {
    const sdk = window.TTMinis as (TikTokMinisLoginSdk | undefined);
    if (!sdk || typeof sdk.login !== 'function') {
        throw new Error('TikTok Minis SDK is unavailable. Open this build inside TikTok.');
    }
    return sdk;
}

function getTikTokPaymentSdk(): TikTokMinisPaymentSdk {
    const sdk = window.TTMinis as (TikTokMinisPaymentSdk | undefined);
    if (!sdk || (typeof sdk.pay !== 'function' && typeof sdk.game?.pay !== 'function')) {
        throw new Error('TikTok Minis payment SDK is unavailable. Open this build inside TikTok.');
    }
    return sdk;
}

function getTikTokAdsSdk(): TikTokMinisAdsSdk {
    const sdk = window.TTMinis as (TikTokMinisAdsSdk | undefined);
    if (!sdk || typeof sdk.createRewardedVideoAd !== 'function') {
        throw new Error('TikTok rewarded ads are unavailable. Update TikTok and try again.');
    }
    if (typeof sdk.canIUse === 'function' && !sdk.canIUse('createRewardedVideoAd')) {
        throw new Error('This TikTok version does not support rewarded ads.');
    }
    return sdk;
}

async function silentLogin(): Promise<PlatformSilentLoginResult> {
    const sdk = getTikTokLoginSdk();

    return new Promise((resolve, reject) => {
        let settled = false;

        const handleLogin = (result: TikTokLoginResponse) => {
            if (settled) return;
            const code = result.authResponse?.code;
            if (typeof code !== 'string' || code.length === 0) {
                settled = true;
                const error = result.error;
                reject(error instanceof Error
                    ? error
                    : new Error('TikTok Minis did not return a login code.'));
                return;
            }
            settled = true;
            resolve({ code });
        };

        try {
            sdk.login(handleLogin);
        } catch (error) {
            settled = true;
            reject(error instanceof Error ? error : new Error('TikTok Minis silent login failed.'));
        }
    });
}

async function payTikTokTradeOrder(tradeOrderId: string): Promise<unknown> {
    if (isTikTokWebTestMode()) {
        console.info('[TikTok web test] Simulated successful payment.', { tradeOrderId });
        return { is_success: true, trade_order_id: tradeOrderId, mock: true };
    }

    const sdk = getTikTokPaymentSdk();

    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('TikTok Minis payment timed out.'));
        }, 60_000);

        const finish = (error?: unknown, result?: unknown) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            if (error) {
                reject(error instanceof Error ? error : new Error('TikTok Minis payment failed.'));
                return;
            }
            resolve(result);
        };

        const handleResult = (result: unknown) => {
            if (result && typeof result === 'object' && 'error' in result) {
                const error = (result as { error?: unknown }).error;
                if (error) {
                    finish(error);
                    return;
                }
            }
            finish(undefined, result);
        };

        try {
            const returned = typeof sdk.pay === 'function'
                ? sdk.pay(handleResult, { trade_order_id: tradeOrderId })
                : sdk.game!.pay({ trade_order_id: tradeOrderId }, handleResult);
            if (returned && typeof (returned as PromiseLike<unknown>).then === 'function') {
                void Promise.resolve(returned).then(
                    (result) => handleResult(result),
                    (error) => finish(error),
                );
            } else if (returned !== undefined) {
                handleResult(returned);
            }
        } catch (error) {
            finish(error);
        }
    });
}

async function showTikTokRewardedAd(adUnitId: string): Promise<PlatformRewardedAdResult> {
    const normalizedAdUnitId = adUnitId.trim();
    if (!normalizedAdUnitId) {
        throw new Error('TikTok rewarded ad placement is not configured.');
    }

    if (isTikTokWebTestMode()) {
        console.info('[TikTok web test] Simulated completed rewarded ad.', {
            adUnitId: normalizedAdUnitId,
        });
        return {
            isEnded: true,
            raw: { mock: true, adUnitId: normalizedAdUnitId, isEnded: true },
        };
    }

    const sdk = getTikTokAdsSdk();
    const ad = sdk.createRewardedVideoAd!({ adUnitId: normalizedAdUnitId });

    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
            finish(new Error('TikTok rewarded ad timed out.'));
        }, 180_000);

        const cleanup = () => {
            window.clearTimeout(timeout);
            ad.offClose?.(handleClose);
            ad.offError?.(handleError);
        };
        const finish = (error?: unknown, result?: PlatformRewardedAdResult) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) {
                reject(error instanceof Error ? error : new Error('TikTok rewarded ad failed.'));
                return;
            }
            resolve(result ?? { isEnded: false });
        };
        const handleClose = (result: TikTokRewardedAdCloseResult) => {
            finish(undefined, { isEnded: result?.isEnded === true, raw: result });
        };
        const handleError = (error?: unknown) => {
            finish(error ?? new Error('TikTok rewarded ad failed to load or play.'));
        };

        ad.onClose(handleClose);
        ad.onError(handleError);
        void ad.show().catch(handleError);
    });
}

export const tiktokPlatform: AppPlatform = {
    kind: 'tiktok',
    auth: { silentLogin },
    // IAP is intentionally retained for a possible later launch. The current
    // product mode is selected in `tiktokMonetization.ts` and defaults to IAA.
    payment: { supported: true, pay: payTikTokTradeOrder },
    ads: { supported: true, showRewarded: showTikTokRewardedAd },
    player: { provider: 'veplayer' },
    lifecycle: { supported: true },
    navigation: { supported: true },
};
