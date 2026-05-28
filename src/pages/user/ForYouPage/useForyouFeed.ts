import { useCallback, useEffect, useRef, useState } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import { FORYOU_DEEP_SCROLL_INDEX, FORYOU_PULL_REFRESH_THRESHOLD_PX } from './foryouConstants';
import { fetchForyouList, type ForyouFetchMode } from './fetchForyouList';
import { mergeForyouFeedItems } from './foryouFeedMerge';
import { clearForyouFeedProgress } from './foryouFeedProgress';
import {
    getForyouFeedSession,
    patchForyouFeedSession,
    setForyouFeedSession,
} from './foryouFeedSession';

function canLoadMoreByDepth(maxIndexReached: number, listLength: number): boolean {
    if (listLength <= FORYOU_DEEP_SCROLL_INDEX) {
        return true;
    }
    return maxIndexReached >= FORYOU_DEEP_SCROLL_INDEX;
}

function syncSession(
    list: IForYouFeedItem[],
    page: number,
    hasMore: boolean,
    maxIndexReached: number,
): void {
    setForyouFeedSession({ list, page, hasMore, maxIndexReached });
}

export function useForyouFeed(sessionBootstrapReady: boolean) {
    const cached = getForyouFeedSession();
    const [list, setList] = useState<IForYouFeedItem[]>(() => cached?.list ?? []);
    const [loading, setLoading] = useState(() => !cached?.list.length);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(() => cached?.hasMore ?? true);
    const pageRef = useRef(cached?.page ?? 1);
    const maxIndexReachedRef = useRef(cached?.maxIndexReached ?? 0);
    const fetchLockRef = useRef(false);
    const pullRefreshLockRef = useRef(false);

    const applyList = useCallback(
        (rows: IForYouFeedItem[], page: number, nextHasMore: boolean, maxIdx: number) => {
            pageRef.current = page;
            maxIndexReachedRef.current = maxIdx;
            setList(rows);
            setHasMore(nextHasMore);
            syncSession(rows, page, nextHasMore, maxIdx);
        },
        [],
    );

    const runFetch = useCallback(
        async (mode: ForyouFetchMode, opts?: { page?: number; lastEpId?: number }) => {
            const res = await fetchForyouList({
                mode,
                page: opts?.page,
                lastEpId: opts?.lastEpId,
            });
            if (!res.ok) {
                return { ok: false as const, message: res.message || `error ${res.code}` };
            }
            return { ok: true as const, payload: res.payload };
        },
        [],
    );

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        const session = getForyouFeedSession();
        if (session?.list.length) {
            setLoading(false);
            setLoadError(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void runFetch('initial').then((res) => {
            if (cancelled) {
                return;
            }
            if (!res.ok) {
                setLoadError(res.message);
                setList([]);
                setHasMore(false);
            } else {
                const rows = res.payload.data;
                applyList(rows, res.payload.current_page ?? 1, res.payload.has_more ?? rows.length > 0, 0);
                setLoadError(null);
            }
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [sessionBootstrapReady, applyList, runFetch]);

    const noteIndexReached = useCallback((index: number) => {
        if (index <= maxIndexReachedRef.current) {
            return;
        }
        maxIndexReachedRef.current = index;
        patchForyouFeedSession({ maxIndexReached: index });
    }, []);

    const refresh = useCallback(async () => {
        if (fetchLockRef.current) {
            return;
        }
        fetchLockRef.current = true;
        setRefreshing(true);
        try {
            const res = await runFetch('refresh');
            if (!res.ok) {
                setLoadError(res.message);
                return;
            }
            const rows = res.payload.data;
            clearForyouFeedProgress();
            applyList(rows, res.payload.current_page ?? 1, res.payload.has_more ?? rows.length > 0, 0);
            setLoadError(null);
        } finally {
            setRefreshing(false);
            fetchLockRef.current = false;
        }
    }, [applyList, runFetch]);

    const loadMore = useCallback(async () => {
        if (
            fetchLockRef.current ||
            loadingMore ||
            !hasMore ||
            !canLoadMoreByDepth(maxIndexReachedRef.current, list.length)
        ) {
            return;
        }
        fetchLockRef.current = true;
        setLoadingMore(true);
        try {
            const nextPage = pageRef.current + 1;
            const last = list[list.length - 1];
            const res = await runFetch('more', {
                page: nextPage,
                lastEpId: last?.ep_id,
            });
            if (!res.ok) {
                return;
            }
            const incoming = res.payload.data;
            if (!incoming.length) {
                setHasMore(false);
                patchForyouFeedSession({ hasMore: false });
                return;
            }
            const merged = mergeForyouFeedItems(list, incoming);
            const page = res.payload.current_page ?? nextPage;
            const nextHasMore = res.payload.has_more ?? incoming.length > 0;
            applyList(merged, page, nextHasMore, maxIndexReachedRef.current);
        } finally {
            setLoadingMore(false);
            fetchLockRef.current = false;
        }
    }, [applyList, hasMore, list, loadingMore, runFetch]);

    const onActiveIndexChange = useCallback(
        (index: number) => {
            noteIndexReached(index);
            if (index !== list.length - 1) {
                return;
            }
            void loadMore();
        },
        [list.length, loadMore, noteIndexReached],
    );

    const onSwiperTouchEnd = useCallback(
        (swiper: SwiperClass) => {
            if (swiper.activeIndex !== 0 || pullRefreshLockRef.current) {
                return;
            }
            if (swiper.translate > FORYOU_PULL_REFRESH_THRESHOLD_PX) {
                pullRefreshLockRef.current = true;
                void refresh().finally(() => {
                    window.setTimeout(() => {
                        pullRefreshLockRef.current = false;
                    }, 800);
                });
            }
        },
        [refresh],
    );

    return {
        list,
        loading,
        loadError,
        refreshing,
        loadingMore,
        hasMore,
        refresh,
        loadMore,
        onActiveIndexChange,
        onSwiperTouchEnd,
    };
}
