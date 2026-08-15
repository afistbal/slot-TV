import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage } from 'react-intl';
// Legacy cold-unmute route state import, currently disabled:
// import { useLocation } from 'react-router';

// Legacy cold-unmute navigation type, currently disabled:
// import { type FeedNavigateDirection } from '@/components/douyin-feed-player';
import { writeMutedPreference } from '@/components/douyin-feed-player/controls/mutePreference';
import { unlockUserAudio } from '@/components/douyin-feed-player/feed/userGesturePlay';
import Loader from '@/components/Loader';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { useVideoPlayerDesktop } from '@/hooks/useVideoPlayerDesktop';
import { useRootStore } from '@/stores/root';
import { useConfigStore } from '@/stores/config';
// Legacy cold-unmute store import, currently disabled:
// import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';
import { useForyouFeedStore } from '@/stores/foryouFeed';

import { ForDemoH5PlayerShell } from './ForDemoH5PlayerShell';
import { ForDemoPcPlayerShell } from './ForDemoPcPlayerShell';
import { useForDemoFeed } from './useForDemoFeed';
import { scheduleForyouVideoEntryPrewarm } from './lib/prewarmVideoEntry';
/* Legacy cold-unmute policy imports, currently disabled:
import { applyForDemoMountMutePolicy } from './forDemoApplyMountMutePolicy';
import {
    markForDemoColdSessionConsumed,
    resolveForDemoMountAutoplayFlags,
    type ForDemoMountAutoplayFlags,
} from './forDemoAutoplayPolicy';
*/

import '@/components/foryou-feed/foryou-vertical.scss';
import '@/styles/video-vertical.scss';
import './for-demo.scss';

const ReelShortTopNav = lazy(() =>
    import('@/components/ReelShortTopNav').then((mod) => ({ default: mod.ReelShortTopNav })),
);

const BOOT_LOADER_DELAY_MS = 100000;

/**
 * for-demo：实验壳 — 与 /foryou 同 API + PC/H5 壳，播放器用 douyin-feed-player。
 */
export default function ForDemoPage() {
    const isDesktop = useVideoPlayerDesktop();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));

    const playbackPolicyAppliedRef = useRef(false);
    if (!playbackPolicyAppliedRef.current) {
        playbackPolicyAppliedRef.current = true;
        writeMutedPreference(false);
        unlockUserAudio();
    }

    /* Legacy cold-unmute mount flow is preserved in
       forDemoAutoplayPolicy.ts / forDemoApplyMountMutePolicy.ts and disabled here:
       const location = useLocation();
       const mountFlagsRef = useRef<ForDemoMountAutoplayFlags | null>(null);
       if (mountFlagsRef.current == null) {
           const flags = resolveForDemoMountAutoplayFlags(location.state);
           mountFlagsRef.current = flags;
           useForDemoColdUnmuteStore.getState().initFromMount(flags);
           applyForDemoMountMutePolicy(flags);
       }
    */

    const [activeIndex, setActiveIndex] = useState(() => {
        /* Legacy cold landing behavior, currently disabled:
           const flags = mountFlagsRef.current;
           if (flags?.feedColdAutoplay) {
               return 0;
           }
        */
        const feedStore = useForyouFeedStore.getState();
        if (!feedStore.isCacheValid()) {
            return 0;
        }
        const idx = feedStore.activeIndex ?? 0;
        return Math.min(Math.max(0, idx), feedStore.list.length - 1);
    });
    const [isFullscreenUi, setIsFullscreenUi] = useState(false);
    const fullscreenTargetRef = useRef<HTMLDivElement>(null);

    const {
        list,
        playerItems,
        loading,
        loadError,
        hasMore,
        loadMore,
        prefetchIfNearEnd,
    } = useForDemoFeed(sessionBootstrapReady, staticBase);
    const showBootLoader = useDelayedVisible(loading, BOOT_LOADER_DELAY_MS);

    useEffect(() => {
        useRootStore.getState().setTheme('dark');
        return () => {
            useRootStore.getState().setTheme('light');
            /* Legacy cold-unmute cleanup, currently disabled:
               markForDemoColdSessionConsumed();
            */
        };
    }, []);

    const handleIndexChange = useCallback(
        (index: number) => {
            setActiveIndex(index);
            useForyouFeedStore.getState().setActiveIndex(index);
            /* Legacy overlay dismissal on index change, currently disabled:
               if (index !== useForDemoColdUnmuteStore.getState().coldLandingIndex) {
                   useForDemoColdUnmuteStore.getState().consumeColdAutoplay();
               }
            */
            prefetchIfNearEnd(index);
        },
        [prefetchIfNearEnd],
    );

    const activeFeedItem = list[activeIndex];
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < playerItems.length - 1 || hasMore;

    useEffect(() => {
        if (loading || !activeFeedItem) {
            return;
        }
        return scheduleForyouVideoEntryPrewarm(activeFeedItem);
    }, [activeFeedItem, loading]);

    const pcTopNav = isDesktop ? (
        <div className="video-vertical-pc-topnav">
            <Suspense fallback={null}>
                <ReelShortTopNav leftAction="none" showSearch />
            </Suspense>
        </div>
    ) : null;

    if (loading) {
        return isDesktop ? (
            <div className="video-vertical-pc-shell for-demo-pc-shell foryou-vertical-pc-shell">
                {pcTopNav}
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                    {showBootLoader ? <Loader color="light" /> : null}
                </div>
            </div>
        ) : (
            <div className="for-demo for-demo--state foryou-vertical foryou-vertical--fullscreen-boot">
                {showBootLoader ? <Loader color="light" /> : null}
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
            fullscreenTargetRef={fullscreenTargetRef}
            isDesktop
            onFullscreenUiChange={setIsFullscreenUi}
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
            fullscreenTargetRef={fullscreenTargetRef}
            onFullscreenUiChange={setIsFullscreenUi}
            onIndexChange={handleIndexChange}
            onLoadMore={() => void loadMore()}
        />
    );

    return isDesktop ? (
        <div className="video-vertical-pc-shell for-demo-pc-shell foryou-vertical-pc-shell">
            {!isFullscreenUi ? pcTopNav : null}
            <div className="for-demo for-demo--pc relative min-h-0 flex-1 overflow-hidden bg-black">
                <div
                    ref={fullscreenTargetRef}
                    className="video-fullscreen-target h-full w-full touch-none select-none"
                >
                    {playerBody}
                </div>
            </div>
        </div>
    ) : (
        <div
            ref={fullscreenTargetRef}
            className="for-demo for-demo--h5 foryou-vertical video-fullscreen-target fixed inset-0 z-0 overflow-hidden bg-black"
        >
            {playerBody}
        </div>
    );
}
