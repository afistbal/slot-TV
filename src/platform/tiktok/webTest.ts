/**
 * Browser-only TikTok flow mode. The DEV guard makes the mocks impossible to
 * enable in a production build even if an environment variable is misplaced.
 */
export function isTikTokWebTestMode(): boolean {
    return import.meta.env.DEV && import.meta.env.VITE_TIKTOK_WEB_TEST === 'true';
}
