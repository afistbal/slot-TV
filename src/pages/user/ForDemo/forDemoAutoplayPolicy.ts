import { isForDemoPathname } from '@/constants/forDemoRoute';
import {
    canNavigateBack,
    isDocumentReload,
} from '@/pages/user/VideoPage/videoPlayerUtils';

const FOR_DEMO_RELOAD_LANDING_KEY = 'for-demo-reload-landing';

/** 仅在 /for-demo F5：标记冷启动（其它页 reload 不误伤） */
if (
    typeof window !== 'undefined' &&
    isDocumentReload() &&
    isForDemoPathname(window.location.pathname)
) {
    try {
        sessionStorage.setItem(FOR_DEMO_RELOAD_LANDING_KEY, '1');
    } catch {
        // ignore
    }
}

export function consumeForDemoReloadLanding(): boolean {
    try {
        if (sessionStorage.getItem(FOR_DEMO_RELOAD_LANDING_KEY) === '1') {
            sessionStorage.removeItem(FOR_DEMO_RELOAD_LANDING_KEY);
            return true;
        }
    } catch {
        // ignore
    }
    return false;
}

export function resolveForDemoFromHomeVideoPlayback(locationState: unknown): boolean {
    if (
        Boolean(
            (locationState as { fromHomeVideoPlayback?: boolean } | null)?.fromHomeVideoPlayback,
        )
    ) {
        return true;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    return canNavigateBack();
}

/** 首条是否静音冷启动（F5 / 广告直链；站内点击进入为 false） */
export function isForDemoFeedColdAutoplay(
    fromHomeVideoPlayback: boolean,
    reloadLanding: boolean,
): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    if (reloadLanding) {
        return true;
    }
    if (fromHomeVideoPlayback) {
        return false;
    }
    return !canNavigateBack();
}

export type ForDemoMountAutoplayFlags = {
    fromHomeVideoPlayback: boolean;
    feedColdAutoplay: boolean;
    reloadLanding: boolean;
};

export function resolveForDemoMountAutoplayFlags(
    locationState: unknown,
): ForDemoMountAutoplayFlags {
    const reloadLanding = consumeForDemoReloadLanding();
    const fromHomeVideoPlayback = reloadLanding
        ? false
        : resolveForDemoFromHomeVideoPlayback(locationState);
    const feedColdAutoplay = isForDemoFeedColdAutoplay(
        fromHomeVideoPlayback,
        reloadLanding,
    );
    return { fromHomeVideoPlayback, feedColdAutoplay, reloadLanding };
}
