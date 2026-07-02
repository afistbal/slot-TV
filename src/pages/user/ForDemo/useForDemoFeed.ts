import { useCallback, useEffect, useRef, useState } from 'react';

import type { DouyinFeedVideoItem } from '@/components/douyin-feed-player';
import { feedDbg } from '@/components/douyin-feed-player/feed/feedDebugLog';
import {
    FORYOU_DEFAULT_PER_PAGE,
    FORYOU_LOAD_MORE_PREFETCH_FROM_END,
} from '@/components/foryou-feed/foryouConstants';
import { fetchForyouList } from '@/pages/user/ForDemo/lib/fetchForyouList';
import { foryouFeedItemKey, mergeForyouFeedItems } from '@/pages/user/ForDemo/lib/foryouFeedMerge';
import { ensureForyouMediaPreconnect, resolveFeedVideoUrl } from '@/pages/user/ForDemo/lib/foryouFeedMedia';
import { getForyouFeedAudienceKey, useForyouFeedStore } from '@/stores/foryouFeed';
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
    return rows.map((row, index) => {
        const url = resolveFeedVideoUrl(row, staticBase);
        return {
            // 列表位 index 保证跨页重复 id-ep_id 时播放器 slide key 仍唯一
            id: `${foryouFeedItemKey(row)}#${index}`,
            url: url ?? '',
            subtitle: row.subtitle != null ? String(row.subtitle) : '',
        };
    });
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
    const nextPageRef = useRef(2);
    const staticBaseRef = useRef(staticBase);
    staticBaseRef.current = staticBase;

    const applyList = useCallback((rows: IForYouFeedItem[], nextHasMore: boolean) => {
        const base = staticBaseRef.current;
        const items = mapRowsToPlayerItems(rows, base);
        feedDbg('feed list apply', {
            count: rows.length,
            playerItems: items.length,
            hasMore: nextHasMore,
        });
        rows.forEach((row, index) => {
            const url = resolveFeedVideoUrl(row, base);
            feedDbg('feed item mp4', {
                index,
                ep_id: row.ep_id,
                hasVideo: Boolean(url),
                videoTail: url ? url.slice(-48) : '',
                rawVideo: row.video ? String(row.video).slice(-40) : '',
            });
        });
        useForyouFeedStore.getState().setFeed({
            list: rows,
            hasMore: nextHasMore,
            audienceKey: getForyouFeedAudienceKey(),
        });
        setList(rows);
        setPlayerItems(items);
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
        const feedStore = useForyouFeedStore.getState();
        if (feedStore.isCacheValid()) {
            nextPageRef.current = Math.max(
                2,
                Math.floor(feedStore.list.length / FORYOU_DEFAULT_PER_PAGE) + 1,
            );
            applyList(feedStore.list, feedStore.hasMore);
            setLoadError(null);
            setLoading(false);
            return;
        }

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
                nextPageRef.current = (res.payload.current_page ?? 1) + 1;
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
            const lastRow = base[base.length - 1];
            const page = nextPageRef.current;
            const res = await fetchForyouList({
                mode: 'more',
                page,
                lastEpId: lastRow?.ep_id,
            });
            if (!res.ok) {
                return;
            }
            const incoming = res.payload.data;
            const batchSize = res.payload.per_page ?? res.payload.count ?? FORYOU_DEFAULT_PER_PAGE;
            if (!incoming.length) {
                setHasMore(false);
                return;
            }
            nextPageRef.current =
                res.payload.current_page != null && res.payload.current_page >= page
                    ? res.payload.current_page + 1
                    : page + 1;
            const merged = mergeForyouFeedItems(base, incoming);
            applyList(merged, inferHasMore(res.payload, batchSize));
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

            feedDbg('loadmore near end', { index, len: list.length });
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
