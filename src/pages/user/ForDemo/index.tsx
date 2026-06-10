import { useCallback, useEffect, useRef, useState } from 'react';

import { DouyinFeedPlayer, type DouyinFeedVideoItem, type FeedNavigateDirection } from '@/components/douyin-feed-player';
import Loader from '@/components/Loader';
import { useConfigStore } from '@/stores/config';

import { fetchForDemoFeedVideos } from './fetchForDemoFeedVideos';

import './for-demo.scss';

function mergeFeedItems(
    prev: DouyinFeedVideoItem[],
    incoming: DouyinFeedVideoItem[],
): DouyinFeedVideoItem[] {
    if (!incoming.length) return prev;
    const seen = new Set(prev.map((item) => String(item.id)));
    const merged = [...prev];
    for (const item of incoming) {
        const key = String(item.id);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
    }
    return merged;
}

/**
 * for-demo：实验壳 — 只请求 /api/foryou，渲染 douyin-feed-player。
 * 与 /for-you 路由、ForYou 业务页无关。
 */
export default function ForDemoPage() {
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const [items, setItems] = useState<DouyinFeedVideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const itemsLengthRef = useRef(items.length);
    itemsLengthRef.current = items.length;
    const loadingMoreRef = useRef(false);
    loadingMoreRef.current = loadingMore;

    // MD-ref: mount-only — 首次进入 for-demo 拉取 /api/foryou，无 DOM/播放器事件可替代
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            const result = await fetchForDemoFeedVideos();
            if (cancelled) return;
            if (!result.ok) {
                setError(result.message);
                setItems([]);
            } else {
                setItems(result.items);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchMoreRef = useRef<() => Promise<void>>(async () => undefined);
    fetchMoreRef.current = async () => {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const result = await fetchForDemoFeedVideos();
            if (result.ok) {
                setItems((prev) => mergeFeedItems(prev, result.items));
            }
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    };

    const handleIndexChange = useCallback((index: number, _direction?: FeedNavigateDirection) => {
        if (index >= itemsLengthRef.current - 2) {
            void fetchMoreRef.current();
        }
    }, []);

    if (loading) {
        return (
            <div className="for-demo for-demo--state">
                <p className="for-demo__hint">Loading /api/foryou…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="for-demo for-demo--state">
                <p className="for-demo__hint for-demo__hint--error">{error}</p>
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="for-demo for-demo--state">
                <p className="for-demo__hint">No videos in /api/foryou</p>
            </div>
        );
    }

    return (
        <div className="for-demo">
            {loadingMore ? (
                <div className="for-demo__loadmore-hint" aria-live="polite">
                    <Loader color="light" />
                </div>
            ) : null}
            <DouyinFeedPlayer
                items={items}
                mediaBaseUrl={staticBase}
                preloadNext
                onIndexChange={handleIndexChange}
            />
        </div>
    );
}
