/**
 * 抖音H5滑动与播放逻辑分析.md §2.5
 * 切条调度：pause 失活 / play 激活
 */
import type { DouyinFeedVideoItem, PlayerSlotState } from '../types';
import { getWindowIndices, shouldInitPlayer } from './shouldInitPlayer';

export function buildPlayerSlots(
    items: DouyinFeedVideoItem[],
    activeIndex: number,
    preloadNext: boolean,
): PlayerSlotState[] {
    const windowIndices = getWindowIndices(activeIndex, items.length);
    let initializedPlayerCount = 0;

    const slots: PlayerSlotState[] = [];

    for (const index of windowIndices) {
        const item = items[index];
        if (!item?.url) continue;

        const positionOffset = index - activeIndex;
        const isActive = positionOffset === 0;
        const shouldInit = shouldInitPlayer({
            index,
            activeIndex,
            initializedPlayerCount,
            preloadNext,
        });

        if (shouldInit) initializedPlayerCount++;

        slots.push({
            index,
            item,
            positionOffset,
            isActive,
            shouldInitPlayer: shouldInit,
        });
    }

    return slots;
}

/** §2.5 + §2.1 feed-active-video 标记 */
export function getFeedItemDataAttrs(isActive: boolean) {
    return {
        'data-e2e': isActive ? 'feed-active-video' : 'feed-video',
    } as const;
}
