import type { AppPlatform } from '../types';

/**
 * The existing H5 implementation remains the source of truth for now.
 * This adapter deliberately does not import or move its login, payment, or
 * player code, so adding the TikTok boundary cannot change Web behaviour.
 */
export const webPlatform: AppPlatform = {
    kind: 'web',
    auth: {},
    payment: { supported: true },
    player: { provider: 'web' },
    lifecycle: { supported: false },
    navigation: { supported: false },
};
