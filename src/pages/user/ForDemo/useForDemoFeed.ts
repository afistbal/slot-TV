import { useCallback, useEffect, useRef, useState } from 'react';

import type { DouyinFeedVideoItem } from '@/components/douyin-feed-player';
import {
    FORYOU_DEFAULT_PER_PAGE,
    FORYOU_LOAD_MORE_PREFETCH_FROM_END,
} from '@/pages/user/ForYouPage/foryouConstants';
import { fetchForyouList } from '@/pages/user/ForYouPage/fetchForyouList';
import { foryouFeedItemKey, mergeForyouFeedItems } from '@/pages/user/ForYouPage/foryouFeedMerge';
import { ensureForyouMediaPreconnect, resolveFeedVideoUrl } from '@/pages/user/ForYouPage/foryouFeedMedia';
import type { IForYouFeedItem, IForYouListPayload } from '@/types/foryouFeed';

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

function mapRowsToPlayerItems(rows: IForYouFeedItem[], staticBase: string): DouyinFeedVideoItem[] {
    const items: DouyinFeedVideoItem[] = [];
    for (const row of rows) {
        const url = resolveFeedVideoUrl(row, staticBase);
        if (!url) continue;
        items.push({ id: foryouFeedItemKey(row), url });
    }
    return items;
}

export function useForDemoFeed(sessionBootstrapReady: boolean, staticBase: string) {
    const [list, setList] = useState<IForYouFeedItem[]>([]);
    const [playerItems, setPlayerItems] = useState<DouyinFeedVideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const listRef = useRef(list);
    listRef.current = list;
    const fetchLockRef = useRef(false);
    const staticBaseRef = useRef(staticBase);
    staticBaseRef.current = staticBase;

    const applyList = useCallback((rows: IForYouFeedItem[], nextHasMore: boolean) => {
        setList(rows);
        setPlayerItems(mapRowsToPlayerItems(rows, staticBaseRef.current));
        setHasMore(nextHasMore);
    }, []);

    useEffect(() => {
        ensureForyouMediaPreconnect(staticBase);
    }, [staticBase]);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        void fetchForyouList({ mode: 'initial' }).then((res) => {
            if (cancelled) {
                return;
            }
            if (!res.ok) {
                setLoadError(res.message || 'unknown error');
                setList([]);
                setPlayerItems([]);
                setHasMore(false);
            } else {
                const rows = res.payload.data;
                const pp = res.payload.per_page ?? res.payload.count ?? FORYOU_DEFAULT_PER_PAGE;
                applyList(rows, inferHasMore(res.payload, pp));
                setLoadError(null);
            }
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [sessionBootstrapReady, applyList]);

    const loadMore = useCallback(async () => {
        if (fetchLockRef.current || loadingMore || !hasMore) {
            return;
        }
        fetchLockRef.current = true;
        setLoadingMore(true);
        try {
            const base = listRef.current;
            const res = await fetchForyouList({ mode: 'initial' });
            if (!res.ok) {
                return;
            }
            const incoming = res.payload.data;
            const pp = res.payload.per_page ?? res.payload.count ?? FORYOU_DEFAULT_PER_PAGE;
            if (!incoming.length) {
                setHasMore(false);
                return;
            }
            const merged = mergeForyouFeedItems(base, incoming);
            const nextHasMore =
                merged.length > base.length ? inferHasMore(res.payload, pp) : false;
            applyList(merged, nextHasMore);
        } finally {
            setLoadingMore(false);
            fetchLockRef.current = false;
        }
    }, [applyList, hasMore, loadingMore]);

    const prefetchIfNearEnd = useCallback(
        (index: number) => {
            if (index < Math.max(0, list.length - FORYOU_LOAD_MORE_PREFETCH_FROM_END)) {
                return;
            }
            void loadMore();
        },
        [list.length, loadMore],
    );

    return {
        list,
        playerItems,
        loading,
        loadError,
        loadingMore,
        hasMore,
        loadMore,
        prefetchIfNearEnd,
    };
}
