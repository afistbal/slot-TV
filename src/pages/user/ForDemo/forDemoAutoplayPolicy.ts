import { isForDemoPathname } from '@/constants/forDemoRoute';
import { isVDemoPathname } from '@/constants/vDemoRoute';
import {
    canNavigateBack,
    isDocumentReload,
} from '@/pages/user/VideoPage/videoPlayerUtils';

const FOR_DEMO_RELOAD_LANDING_KEY = 'for-demo-reload-landing';
/** 同文档会话内 for-demo 冷蒙层已展示/离开过，SPA 返回不再当冷启动 */
const FOR_DEMO_COLD_SESSION_CONSUMED_KEY = 'for-demo-cold-session-consumed';

export function markForDemoColdSessionConsumed(): void {
    try {
        sessionStorage.setItem(FOR_DEMO_COLD_SESSION_CONSUMED_KEY, '1');
    } catch {
        // ignore
    }
}

export function isForDemoColdSessionConsumed(): boolean {
    try {
        return sessionStorage.getItem(FOR_DEMO_COLD_SESSION_CONSUMED_KEY) === '1';
    } catch {
        return false;
    }
}

/** 仅在 /for-demo、/v-demo F5：标记冷启动（其它页 reload 不误伤） */
if (
    typeof window !== 'undefined' &&
    isDocumentReload() &&
    (isForDemoPathname(window.location.pathname) ||
        isVDemoPathname(window.location.pathname))
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
    if (isForDemoColdSessionConsumed()) {
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
