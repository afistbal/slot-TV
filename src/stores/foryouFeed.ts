import { create } from 'zustand';

import type { IForYouFeedItem } from '@/types/foryouFeed';

import { useUserStore } from './user';

const LEGACY_FORYOU_FEED_SESSION_STORAGE_KEY = 'foryou-feed-session-v1';

/** 用户身份 + VIP 变化时失效（重登、换 VIP） */
export function getForyouFeedAudienceKey(): string {
    const user = useUserStore.getState();
    if (!user.signed || !user.info) {
        return 'guest';
    }
    const id = user.info['id'] ?? user.info['user_id'] ?? '';
    const vip = user.isVIP() ? '1' : '0';
    const anon = user.isAnonymous() ? '1' : '0';
    return `${String(id)}:${vip}:${anon}`;
}

type ForyouFeedState = {
    list: IForYouFeedItem[];
    hasMore: boolean;
    activeIndex: number;
    audienceKey: string | null;
    setFeed: (payload: {
        list: IForYouFeedItem[];
        hasMore: boolean;
        audienceKey: string;
    }) => void;
    setActiveIndex: (activeIndex: number) => void;
    clear: () => void;
    isCacheValid: () => boolean;
};

export const useForyouFeedStore = create<ForyouFeedState>((set, get) => ({
    list: [],
    hasMore: true,
    activeIndex: 0,
    audienceKey: null,
    setFeed: ({ list, hasMore, audienceKey }) => set({ list, hasMore, audienceKey }),
    setActiveIndex: (activeIndex) => set({ activeIndex }),
    clear: () => set({ list: [], hasMore: true, activeIndex: 0, audienceKey: null }),
    isCacheValid: () => {
        const state = get();
        return state.list.length > 0 && state.audienceKey === getForyouFeedAudienceKey();
    },
}));

export function clearForyouFeedStore(): void {
    useForyouFeedStore.getState().clear();
}

/** 清掉旧版 sessionStorage 残留，避免与内存 store 混用 */
function clearLegacyForyouFeedSessionStorage(): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    try {
        sessionStorage.removeItem(LEGACY_FORYOU_FEED_SESSION_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

clearLegacyForyouFeedSessionStorage();
