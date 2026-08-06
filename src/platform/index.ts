import { tiktokPlatform } from './tiktok';
import type { AppPlatform, PlatformKind } from './types';
import { webPlatform } from './web';

export type {
    AppPlatform,
    PlatformKind,
    PlatformRewardedAdResult,
    PlatformSilentLoginResult,
} from './types';

function configuredPlatform(): PlatformKind {
    return import.meta.env.MODE === 'tiktok' || import.meta.env.VITE_PLATFORM === 'tiktok'
        ? 'tiktok'
        : 'web';
}

/**
 * Single platform entry point for all new cross-platform product work.
 * Existing H5 code is intentionally not retrofitted in this task.
 */
export function getPlatform(): AppPlatform {
    return configuredPlatform() === 'tiktok' ? tiktokPlatform : webPlatform;
}

export function isTikTokPlatform(): boolean {
    return configuredPlatform() === 'tiktok';
}
