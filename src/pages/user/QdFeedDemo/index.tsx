/**
 * QD: app/video/page-2d070b8da4226bcf.js L1865–1891 组装 + L1512–1525 tN
 * 数据源：与 /foryou 相同 API（useForDemoFeed / fetchForyouList）
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import Loader from '@/components/Loader';
import { QdVerticalFeed, QdVideoSlot } from '@/components/qd-feed-demo';
import type { QdVerticalFeedHandle } from '@/components/qd-feed-demo/types';
import { useRootStore } from '@/stores/root';
import { useConfigStore } from '@/stores/config';
import { useForDemoFeed } from '@/pages/user/ForDemo/useForDemoFeed';

import { mapForyouToQdFeedItems } from './mapForyouToQdFeedItems';

import '@/components/qd-feed-demo/qd-feed-demo.scss';

export default function QdFeedDemoPage() {
    const navigate = useNavigate();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const feedRef = useRef<QdVerticalFeedHandle>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const { list, loading, loadError, hasMore, prefetchIfNearEnd } = useForDemoFeed(
        sessionBootstrapReady,
        staticBase,
    );

    const qdItems = useMemo(
        () => mapForyouToQdFeedItems(list, staticBase),
        [list, staticBase],
    );

    /** QD: tN(t) — page L1512–1525 */
    const handleVideoEnd = useCallback(
        (endedIndex: number) => {
            const next = endedIndex + 1;
            if (next >= qdItems.length) return;
            setCurrentIndex(next);
            feedRef.current?.scrollTo(next);
        },
        [qdItems.length],
    );

    const handleSlideChange = useCallback(
        (index: number) => {
            setCurrentIndex(index);
            prefetchIfNearEnd(index);
        },
        [prefetchIfNearEnd],
    );

    const mountedSlots = qdItems
        .map((_, i) => i)
        .filter((i) => i === currentIndex || i === currentIndex + 1);

    if (loading) {
        return (
            <div className="qd-feed-demo-page flex items-center justify-center">
                <Loader color="light" />
            </div>
        );
    }

    if (loadError || qdItems.length === 0) {
        return (
            <div className="qd-feed-demo-page flex flex-col items-center justify-center gap-4 p-6 text-center text-sm text-white/70">
                <p>{loadError ?? 'No videos'}</p>
                <button
                    type="button"
                    className="qd-feed-demo-page__back static! relative!"
                    onClick={() => navigate(-1)}
                >
                    返回
                </button>
            </div>
        );
    }

    const safeIndex = Math.min(currentIndex, qdItems.length - 1);

    return (
        <div className="qd-feed-demo-page">
            <div className="qd-feed-demo-page__debug">
                QD-Demo | foryou API | index={safeIndex + 1}/{qdItems.length}
                {hasMore ? '+' : ''} | preload=[{mountedSlots.join(',')}]
            </div>
            <button
                type="button"
                className="qd-feed-demo-page__back"
                onClick={() => navigate(-1)}
            >
                返回
            </button>
            <QdVerticalFeed
                ref={feedRef}
                items={qdItems}
                currentIndex={safeIndex}
                onSlideChange={handleSlideChange}
                renderItem={(item, index) => (
                    <QdVideoSlot
                        videoId={item.id}
                        index={index}
                        src={item.url}
                        pic={item.pic}
                        isPlay={safeIndex === index}
                        subtitleUrlList={item.subtitleUrlList}
                        onVideoEnd={() => handleVideoEnd(index)}
                    />
                )}
            />
        </div>
    );
}
