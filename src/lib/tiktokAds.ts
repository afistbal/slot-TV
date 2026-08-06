import { api } from '@/api';
import { isTikTokPlatform } from '@/platform';
import { setTikTokRewardedAdUnitIds } from '@/lib/tiktokMonetization';

type TikTokAdRecord = Record<string, unknown>;

let initializePromise: Promise<void> | null = null;

function isEnabledAd(record: TikTokAdRecord): boolean {
    const raw = record.enabled ?? record.is_enabled ?? record.status;
    if (raw == null) return true;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;

    const status = String(raw).trim().toLowerCase();
    return status === '1' || status === 'enabled' || status === 'active';
}

function adIdFromRecord(record: TikTokAdRecord): string {
    const raw = record.ad_id ?? record.ad_unit_id ?? record.id;
    return typeof raw === 'string' ? raw.trim() : '';
}

function recordsFromPayload(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const record = payload as TikTokAdRecord;
    for (const key of ['data', 'ads', 'list', 'items']) {
        if (Array.isArray(record[key])) return record[key];
    }
    return [];
}

function enabledAdIdsFromPayload(payload: unknown): string[] {
    return recordsFromPayload(payload)
        .flatMap((item) => {
            if (typeof item === 'string') return [item.trim()];
            if (!item || typeof item !== 'object') return [];
            const record = item as TikTokAdRecord;
            if (!isEnabledAd(record)) return [];
            return [adIdFromRecord(record)];
        })
        .filter(Boolean);
}

/** Loads the server-owned TikTok ad allowlist once for the current app session. */
export function initializeTikTokAds(): Promise<void> {
    if (!isTikTokPlatform()) return Promise.resolve();
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
        try {
            const result = await api<unknown>('tiktok/ads', {
                method: 'get',
                loading: false,
                toastOnError: false,
            });
            if (result.c !== 0) return;
            setTikTokRewardedAdUnitIds(enabledAdIdsFromPayload(result.d));
        } catch (error) {
            console.warn('[TikTok ads] Failed to load ad units; using the default.', error);
        }
    })();

    return initializePromise;
}
