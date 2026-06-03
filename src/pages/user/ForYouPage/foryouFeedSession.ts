import type { IForYouFeedItem } from '@/types/foryouFeed';

export type ForyouFeedSession = {
    list: IForYouFeedItem[];
    page: number;
    hasMore: boolean;
    maxIndexReached: number;
    perPage?: number;
};

let session: ForyouFeedSession | null = null;

export function getForyouFeedSession(): ForyouFeedSession | null {
    return session;
}

export function setForyouFeedSession(next: ForyouFeedSession): void {
    session = next;
}

export function patchForyouFeedSession(patch: Partial<ForyouFeedSession>): void {
    if (!session) {
        return;
    }
    session = { ...session, ...patch };
}

export function clearForyouFeedSession(): void {
    session = null;
}
