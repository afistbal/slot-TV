import type { IForYouFeedItem } from '@/types/foryouFeed';

export type ForyouFeedSession = {
    list: IForYouFeedItem[];
    page: number;
    hasMore: boolean;
    maxIndexReached: number;
    perPage?: number;
    /** 当前竖滑索引，从 /video 返回时恢复同一条 */
    activeIndex?: number;
};

const FORYOU_FEED_SESSION_STORAGE_KEY = 'foryou-feed-session-v1';

let session: ForyouFeedSession | null = null;

function persistSessionToStorage(next: ForyouFeedSession | null): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    if (!next?.list?.length) {
        sessionStorage.removeItem(FORYOU_FEED_SESSION_STORAGE_KEY);
        return;
    }
    try {
        sessionStorage.setItem(FORYOU_FEED_SESSION_STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* quota / private mode */
    }
}

function readSessionFromStorage(): ForyouFeedSession | null {
    if (typeof sessionStorage === 'undefined') {
        return null;
    }
    try {
        const raw = sessionStorage.getItem(FORYOU_FEED_SESSION_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as ForyouFeedSession;
        if (!Array.isArray(parsed?.list) || !parsed.list.length) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function getForyouFeedSession(): ForyouFeedSession | null {
    if (session?.list?.length) {
        return session;
    }
    const stored = readSessionFromStorage();
    if (stored) {
        session = stored;
    }
    return session;
}

export function setForyouFeedSession(next: ForyouFeedSession): void {
    session = next;
    persistSessionToStorage(next);
}

export function patchForyouFeedSession(patch: Partial<ForyouFeedSession>): void {
    if (!session) {
        const stored = readSessionFromStorage();
        if (!stored) {
            return;
        }
        session = stored;
    }
    session = { ...session, ...patch };
    persistSessionToStorage(session);
}

export function clearForyouFeedSession(): void {
    session = null;
    persistSessionToStorage(null);
}
