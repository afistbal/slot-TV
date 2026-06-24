import type { VideoPaywallTier } from '@/components/video-paywall/videoPaywallPromoTypes';

const OPEN_COUNT_KEY = 'video-paywall-open-count';
const WEEKLY_ACCEPTED_KEY = 'video-paywall-weekly-accepted';
const YEARLY_ACCEPTED_KEY = 'video-paywall-yearly-accepted';
const WEEKLY_EXPIRES_KEY = 'video-paywall-weekly-expires';
const YEARLY_EXPIRES_KEY = 'video-paywall-yearly-expires';

export type VideoPaywallPromoPersisted = {
    openCount: number;
    weeklyAccepted: boolean;
    yearlyAccepted: boolean;
    weeklyExpiresAt: number | null;
    yearlyExpiresAt: number | null;
};

function readInt(key: string, fallback = 0): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return fallback;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) ? n : fallback;
    } catch {
        return fallback;
    }
}

function readBool(key: string): boolean {
    try {
        return localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}

function readExpires(key: string): number | null {
    const n = readInt(key, 0);
    return n > 0 ? n : null;
}

export function loadVideoPaywallPromoPersisted(): VideoPaywallPromoPersisted {
    return {
        openCount: readInt(OPEN_COUNT_KEY, 0),
        weeklyAccepted: readBool(WEEKLY_ACCEPTED_KEY),
        yearlyAccepted: readBool(YEARLY_ACCEPTED_KEY),
        weeklyExpiresAt: readExpires(WEEKLY_EXPIRES_KEY),
        yearlyExpiresAt: readExpires(YEARLY_EXPIRES_KEY),
    };
}

export function saveVideoPaywallPromoPersisted(data: VideoPaywallPromoPersisted): void {
    try {
        localStorage.setItem(OPEN_COUNT_KEY, String(data.openCount));
        localStorage.setItem(WEEKLY_ACCEPTED_KEY, data.weeklyAccepted ? '1' : '0');
        localStorage.setItem(YEARLY_ACCEPTED_KEY, data.yearlyAccepted ? '1' : '0');
        localStorage.setItem(
            WEEKLY_EXPIRES_KEY,
            data.weeklyExpiresAt ? String(data.weeklyExpiresAt) : '0',
        );
        localStorage.setItem(
            YEARLY_EXPIRES_KEY,
            data.yearlyExpiresAt ? String(data.yearlyExpiresAt) : '0',
        );
    } catch {
        /* noop */
    }
}

export function clearVideoPaywallPromoPersisted(): void {
    saveVideoPaywallPromoPersisted({
        openCount: 0,
        weeklyAccepted: false,
        yearlyAccepted: false,
        weeklyExpiresAt: null,
        yearlyExpiresAt: null,
    });
}

export function isOfferActive(expiresAt: number | null, nowSec = Math.floor(Date.now() / 1000)): boolean {
    return expiresAt != null && expiresAt > nowSec;
}

/** 整轮复位：年优惠倒计时结束；或周/年优惠均已过期 */
export function shouldResetPromoCycle(
    data: VideoPaywallPromoPersisted,
    nowSec = Math.floor(Date.now() / 1000),
): boolean {
    if (data.yearlyAccepted && data.yearlyExpiresAt != null && nowSec >= data.yearlyExpiresAt) {
        return true;
    }
    if (!data.yearlyAccepted && data.weeklyAccepted && data.weeklyExpiresAt != null && nowSec >= data.weeklyExpiresAt) {
        return true;
    }
    if (
        data.openCount >= 2 &&
        data.weeklyExpiresAt != null &&
        nowSec >= data.weeklyExpiresAt &&
        (!data.yearlyAccepted || (data.yearlyExpiresAt != null && nowSec >= data.yearlyExpiresAt))
    ) {
        return true;
    }
    return false;
}

export function acceptTierInStorage(
    data: VideoPaywallPromoPersisted,
    tier: VideoPaywallTier,
    nowSec = Math.floor(Date.now() / 1000),
    durationSec: number,
): VideoPaywallPromoPersisted {
    const expiresAt = nowSec + durationSec;
    if (tier === 'weekly') {
        return {
            ...data,
            weeklyAccepted: true,
            weeklyExpiresAt: expiresAt,
        };
    }
    return {
        ...data,
        yearlyAccepted: true,
        yearlyExpiresAt: expiresAt,
    };
}
