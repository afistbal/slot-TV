import {
    canNavigateBack,
    isDocumentReload,
} from '@/pages/user/VideoPage/videoPlayerUtils';

const FORYOU_RELOAD_LANDING_KEY = 'foryou-reload-landing';

/** 文档级 F5 时写入；For You 首次 mount 消费一次，避免与 SPA「从首页进入」互相覆盖 */
if (typeof window !== 'undefined' && isDocumentReload()) {
    try {
        sessionStorage.setItem(FORYOU_RELOAD_LANDING_KEY, '1');
    } catch {
        // ignore
    }
}

/**
 * 本次文档加载后，For You 是否处于「F5 落页」的**一次性**冷启动。
 * 仅在 `ForYouVerticalSwiper` 首次 mount 时调用一次。
 */
export function consumeForyouReloadLanding(): boolean {
    try {
        if (sessionStorage.getItem(FORYOU_RELOAD_LANDING_KEY) === '1') {
            sessionStorage.removeItem(FORYOU_RELOAD_LANDING_KEY);
            return true;
        }
    } catch {
        // ignore
    }
    return false;
}

/**
 * 是否「从站内首页/底栏/顶栏等用户点击进入」（有声、无冷启动蒙层）。
 * 显式 `VIDEO_FROM_HOME_STATE` 始终优先；其余用路由栈判断。
 */
export function resolveForyouFromHomeVideoPlayback(locationState: unknown): boolean {
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

/**
 * For You 首条是否静音冷启动（仅首条 load；滑切恒有声）。
 *
 * @param reloadLanding `consumeForyouReloadLanding()` 的结果（每 mount 至多 true 一次）
 */
export function isForyouFeedColdAutoplay(
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

/** 在 Swiper mount 时算好 fromHome / 冷启动，避免 F5 残留 state 与 SPA 首页进入冲突 */
export function resolveForyouMountAutoplayFlags(locationState: unknown): {
    fromHomeVideoPlayback: boolean;
    feedColdAutoplay: boolean;
    reloadLanding: boolean;
} {
    const reloadLanding = consumeForyouReloadLanding();
    const fromHomeVideoPlayback = reloadLanding
        ? false
        : resolveForyouFromHomeVideoPlayback(locationState);
    const feedColdAutoplay = isForyouFeedColdAutoplay(
        fromHomeVideoPlayback,
        reloadLanding,
    );
    return { fromHomeVideoPlayback, feedColdAutoplay, reloadLanding };
}

/** 首条是否应优先「有声」自动播（与 `isForyouFeedColdAutoplay` 互斥） */
export function preferForyouSoundAutoplay(isFeedColdAutoplay: boolean): boolean {
    return !isFeedColdAutoplay;
}
