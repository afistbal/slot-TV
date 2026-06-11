import { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useLocation } from 'react-router';

import { type FeedNavigateDirection } from '@/components/douyin-feed-player';
import Loader from '@/components/Loader';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useRootStore } from '@/stores/root';
import { useConfigStore } from '@/stores/config';
import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';

import { ForDemoH5PlayerShell } from './ForDemoH5PlayerShell';
import { ForDemoPcPlayerShell } from './ForDemoPcPlayerShell';
import { useForDemoFeed } from './useForDemoFeed';
import { applyForDemoMountMutePolicy } from './forDemoApplyMountMutePolicy';
import {
    markForDemoColdSessionConsumed,
    resolveForDemoMountAutoplayFlags,
    type ForDemoMountAutoplayFlags,
} from './forDemoAutoplayPolicy';

import '@/components/foryou-feed/foryou-vertical.scss';
import './for-demo.scss';

/**
 * for-demo：实验壳 — 与 /foryou 同 API + PC/H5 壳，播放器用 douyin-feed-player。
 */
export default function ForDemoPage() {
    const isDesktop = useMinWidth768();
    const location = useLocation();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));

    const mountFlagsRef = useRef<ForDemoMountAutoplayFlags | null>(null);
    if (mountFlagsRef.current == null) {
        const flags = resolveForDemoMountAutoplayFlags(location.state);
        mountFlagsRef.current = flags;
        useForDemoColdUnmuteStore.getState().initFromMount(flags);
        applyForDemoMountMutePolicy(flags);
    }

    const [activeIndex, setActiveIndex] = useState(0);

    const {
        list,
        playerItems,
        loading,
        loadError,
        loadingMore,
        hasMore,
        loadMore,
        prefetchIfNearEnd,
    } = useForDemoFeed(sessionBootstrapReady, staticBase);

    useEffect(() => {
        useRootStore.getState().setTheme('dark');
        return () => {
            useRootStore.getState().setTheme('light');
            markForDemoColdSessionConsumed();
        };
    }, []);

    const handleIndexChange = useCallback(
        (index: number, _direction?: FeedNavigateDirection) => {
            setActiveIndex(index);
            if (index !== useForDemoColdUnmuteStore.getState().coldLandingIndex) {
                useForDemoColdUnmuteStore.getState().consumeColdAutoplay();
            }
            prefetchIfNearEnd(index);
        },
        [prefetchIfNearEnd],
    );

    const activeFeedItem = list[activeIndex];
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < playerItems.length - 1 || hasMore;

    const pcTopNav = isDesktop ? (
        <div className="video-vertical-pc-topnav">
            <ReelShortTopNav leftAction="none" showSearch />
        </div>
    ) : null;

    if (loading) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell for-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                    <Loader color="light" />
                </div>
            </div>
        ) : (
            <div className="for-demo for-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                <Loader color="light" />
            </div>
        );
    }

    if (loadError) {
        const errBody = (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black p-6 text-center text-sm text-white/70">
                {loadError}
            </div>
        );
        return isDesktop ? (
            <div className="video-vertical-pc-shell for-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                {errBody}
            </div>
        ) : (
            <div className="for-demo for-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                {errBody}
            </div>
        );
    }

    if (!playerItems.length || !activeFeedItem) {
        const emptyBody = (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black text-sm text-white/60">
                <FormattedMessage id="foryou_no_recommendations" defaultMessage="No videos" />
            </div>
        );
        return isDesktop ? (
            <div className="video-vertical-pc-shell for-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                {emptyBody}
            </div>
        ) : (
            <div className="for-demo for-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                {emptyBody}
            </div>
        );
    }

    const playerBody = isDesktop ? (
        <ForDemoPcPlayerShell
            staticBase={staticBase}
            feedItem={activeFeedItem}
            playerItems={playerItems}
            activeIndex={activeIndex}
            hasPrev={hasPrev}
            hasNext={hasNext}
            hasMore={hasMore}
            listLength={list.length}
            onIndexChange={handleIndexChange}
            onLoadMore={() => void loadMore()}
        />
    ) : (
        <ForDemoH5PlayerShell
            staticBase={staticBase}
            feedItem={activeFeedItem}
            playerItems={playerItems}
            activeIndex={activeIndex}
            hasNext={hasNext}
            hasMore={hasMore}
            listLength={list.length}
            onIndexChange={handleIndexChange}
            onLoadMore={() => void loadMore()}
        />
    );

    return isDesktop ? (
        <div className="video-vertical-pc-shell for-demo-pc-shell foryou-vertical-pc-shell">
            {pcTopNav}
            <div className="for-demo for-demo--pc relative min-h-0 flex-1 overflow-hidden bg-black">
                {loadingMore ? (
                    <div
                        className="foryou-vertical__edge-hint foryou-vertical__edge-hint--bottom"
                        aria-live="polite"
                    >
                        <Loader color="light" />
                    </div>
                ) : null}
                <div className="video-fullscreen-target h-full w-full touch-none select-none">
                    {playerBody}
                </div>
            </div>
        </div>
    ) : (
        <div className="for-demo for-demo--h5 foryou-vertical fixed inset-0 z-0 overflow-hidden bg-black">
            {loadingMore ? (
                <div
                    className="foryou-vertical__edge-hint foryou-vertical__edge-hint--bottom"
                    aria-live="polite"
                >
                    <Loader color="light" />
                </div>
            ) : null}
            {playerBody}
        </div>
    );
}
