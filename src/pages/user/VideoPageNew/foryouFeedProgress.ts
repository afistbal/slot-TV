import type { IForYouFeedItem } from '@/types/foryouFeed';
import { foryouFeedItemKey } from './foryouFeedMerge';

/** 同一会话内 For You 各条播放进度（秒），滑走再回来续播 */
const progressSecByKey = new Map<string, number>();

const MIN_SAVE_SEC = 1;
/** 距结尾小于该秒数视为看完，下次从头播 */
const END_MARGIN_SEC = 2;

export function getForyouFeedProgressSec(item: Pick<IForYouFeedItem, 'id' | 'ep_id'>): number {
    const t = progressSecByKey.get(foryouFeedItemKey(item));
    if (t == null || !Number.isFinite(t) || t < MIN_SAVE_SEC) {
        return 0;
    }
    return t;
}

export function setForyouFeedProgressSec(
    item: Pick<IForYouFeedItem, 'id' | 'ep_id'>,
    sec: number,
    durationSec?: number,
): void {
    const key = foryouFeedItemKey(item);
    if (!Number.isFinite(sec) || sec < MIN_SAVE_SEC) {
        progressSecByKey.delete(key);
        return;
    }
    if (
        durationSec != null &&
        Number.isFinite(durationSec) &&
        durationSec > END_MARGIN_SEC &&
        sec >= durationSec - END_MARGIN_SEC
    ) {
        progressSecByKey.delete(key);
        return;
    }
    progressSecByKey.set(key, sec);
}

export function clearForyouFeedProgress(): void {
    progressSecByKey.clear();
}
