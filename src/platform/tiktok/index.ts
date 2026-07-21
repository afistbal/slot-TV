import type { AppPlatform, PlatformSilentLoginResult } from '../types';

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

export const tiktokPlatform: AppPlatform = {
    kind: 'tiktok',
    auth: { silentLogin },
    payment: { supported: true, pay: payTikTokTradeOrder },
    player: { provider: 'veplayer' },
    lifecycle: { supported: true },
    navigation: { supported: true },
};
