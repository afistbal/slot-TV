/**
 * Cross-platform boundary for product code.
 *
 * The interfaces describe capabilities, rather than binding product pages to a
 * Web payment provider or the TikTok SDK. Implementations are added only when
 * their server-side dependency is ready.
 */
export type PlatformKind = 'web' | 'tiktok';

export interface PlatformSilentLoginResult {
    /** One-time code that must be exchanged by our server, never by the client. */
    code: string;
}

export interface PlatformAuth {
    silentLogin?: () => Promise<PlatformSilentLoginResult>;
}

export interface PlatformPayment {
    /** Whether the current platform exposes a native payment flow. */
    readonly supported: boolean;
    /** Starts a native payment for a server-created trade order. */
    pay?: (tradeOrderId: string) => Promise<unknown>;
}

export interface PlatformRewardedAdResult {
    /** TikTok only grants the reward when the video reached its natural end. */
    isEnded: boolean;
    /** Unmodified SDK close callback, kept for device debugging and telemetry. */
    raw?: unknown;
}

export interface PlatformAds {
    readonly supported: boolean;
    showRewarded?: (adUnitId: string) => Promise<PlatformRewardedAdResult>;
}

export interface PlatformPlayer {
    /** Reserved for the platform-specific player adapter in DEV-04. */
    readonly provider: 'web' | 'veplayer';
}

export interface PlatformLifecycle {
    /** Lifecycle events are wired for TikTok in DEV-06. */
    readonly supported: boolean;
}

export interface PlatformNavigation {
    /** Native navigation hooks are wired only where the host supports them. */
    readonly supported: boolean;
}

export interface AppPlatform {
    readonly kind: PlatformKind;
    readonly auth: PlatformAuth;
    readonly payment: PlatformPayment;
    readonly ads: PlatformAds;
    readonly player: PlatformPlayer;
    readonly lifecycle: PlatformLifecycle;
    readonly navigation: PlatformNavigation;
}
