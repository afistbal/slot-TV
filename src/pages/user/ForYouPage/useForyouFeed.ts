import { useCallback, useEffect, useRef, useState } from 'react';

import type { Swiper as SwiperClass } from 'swiper';

import type { IForYouFeedItem, IForYouListPayload } from '@/types/foryouFeed';

import {
    FORYOU_DEFAULT_PER_PAGE,
    FORYOU_LOAD_MORE_PREFETCH_FROM_END,
    FORYOU_PULL_REFRESH_THRESHOLD_PX,
} from './foryouConstants';
import { fetchForyouList, type ForyouFetchMode } from './fetchForyouList';
import { mergeForyouFeedItems } from './foryouFeedMerge';
import { clearForyouFeedProgress } from './foryouFeedProgress';
import {
    getForyouFeedSession,
    patchForyouFeedSession,
    setForyouFeedSession,
} from './foryouFeedSession';

function inferHasMore(payload: IForYouListPayload, fallbackPerPage: number): boolean {
    const rows = payload.data;
    if (!rows.length) {
        return false;
    }
    if (payload.has_more === true) {
        return true;
    }
    if (payload.has_more === false) {
        return false;
    }
    const batchSize = payload.per_page ?? payload.count ?? fallbackPerPage;
    if (batchSize > 0 && rows.length >= batchSize) {
        return true;
    }
    return false;
}

export function isNearForyouFeedEnd(index: number, listLength: number): boolean {
    if (listLength <= 0 || index < 0) {
        return false;
    }
    return index >= Math.max(0, listLength - FORYOU_LOAD_MORE_PREFETCH_FROM_END);
}

function syncSession(
    list: IForYouFeedItem[],
    page: number,
    hasMore: boolean,
    maxIndexReached: number,
    perPage: number,
): void {
    setForyouFeedSession({ list, page, hasMore, maxIndexReached, perPage });
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
    const perPageRef = useRef(cached?.perPage ?? FORYOU_DEFAULT_PER_PAGE);
    const maxIndexReachedRef = useRef(cached?.maxIndexReached ?? 0);
    const listRef = useRef(list);
    listRef.current = list;
    const fetchLockRef = useRef(false);
    const pullRefreshLockRef = useRef(false);

    const applyList = useCallback(
        (rows: IForYouFeedItem[], page: number, nextHasMore: boolean, maxIdx: number, perPage?: number) => {
            if (perPage != null && perPage > 0) {
                perPageRef.current = perPage;
            }
            pageRef.current = page;
            maxIndexReachedRef.current = maxIdx;
            setList(rows);
            setHasMore(nextHasMore);
            syncSession(rows, page, nextHasMore, maxIdx, perPageRef.current);
        },
        [],
    );

    const runFetch = useCallback(async (mode: ForyouFetchMode) => {
        const res = await fetchForyouList({ mode });
        if (!res.ok) {
            return { ok: false as const, message: res.message || `error ${res.code}` };
        }
        return { ok: true as const, payload: res.payload };
    }, []);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        const session = getForyouFeedSession();
        if (session?.list.length) {
            setLoading(false);
            setLoadError(null);
            pageRef.current = session.page;
            perPageRef.current = session.perPage ?? FORYOU_DEFAULT_PER_PAGE;
            /** 修复旧 session 误标 hasMore:false（满页仍应可续拉） */
            if (!session.hasMore && session.list.length >= perPageRef.current) {
                setHasMore(true);
                patchForyouFeedSession({ hasMore: true });
            }
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
                const pp = res.payload.per_page ?? res.payload.count ?? FORYOU_DEFAULT_PER_PAGE;
                applyList(rows, res.payload.current_page ?? 1, inferHasMore(res.payload, pp), 0, pp);
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
            const pp = res.payload.per_page ?? res.payload.count ?? perPageRef.current;
            clearForyouFeedProgress();
            applyList(rows, res.payload.current_page ?? 1, inferHasMore(res.payload, pp), 0, pp);
            setLoadError(null);
        } finally {
            setRefreshing(false);
            fetchLockRef.current = false;
        }
    }, [applyList, runFetch]);

    /** 滑到倒数第 2 条时再次请求 /api/foryou，去重后拼接到列表末尾 */
    const loadMore = useCallback(async () => {
        if (fetchLockRef.current || loadingMore || !hasMore) {
            return;
        }
        fetchLockRef.current = true;
        setLoadingMore(true);
        try {
            const base = listRef.current;
            const res = await runFetch('initial');
            if (!res.ok) {
                return;
            }
            const incoming = res.payload.data;
            const pp = res.payload.per_page ?? res.payload.count ?? perPageRef.current;
            if (!incoming.length) {
                setHasMore(false);
                patchForyouFeedSession({ hasMore: false });
                return;
            }
            const merged = mergeForyouFeedItems(base, incoming);
            const nextPage = pageRef.current + 1;
            const nextHasMore =
                merged.length > base.length ? inferHasMore(res.payload, pp) : false;
            applyList(merged, nextPage, nextHasMore, maxIndexReachedRef.current, pp);
        } finally {
            setLoadingMore(false);
            fetchLockRef.current = false;
        }
    }, [applyList, hasMore, loadingMore, runFetch]);

    const prefetchIfNearEnd = useCallback(
        (index: number) => {
            if (!isNearForyouFeedEnd(index, list.length)) {
                return;
            }
            void loadMore();
        },
        [list.length, loadMore],
    );

    const onActiveIndexChange = useCallback(
        (index: number) => {
            noteIndexReached(index);
            prefetchIfNearEnd(index);
        },
        [noteIndexReached, prefetchIfNearEnd],
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
        prefetchIfNearEnd,
        onActiveIndexChange,
        onSwiperTouchEnd,
    };
}
