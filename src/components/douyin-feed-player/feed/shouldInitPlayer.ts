/**
 * 抖音H5滑动与播放逻辑分析.md §2.6.2
 * routes-route L17947-17951 isInitPlayer 门控（简化版）
 */
import { PLAYER_WINDOW_RADIUS } from '../constants';

export function shouldInitPlayer(opts: {
    index: number;
    activeIndex: number;
    initializedPlayerCount: number;
    preloadNext: boolean;
}): boolean {
    const { index, activeIndex, initializedPlayerCount, preloadNext } = opts;
    const positionOffset = index - activeIndex;
    const isActive = positionOffset === 0;
    const isNext = positionOffset === 1;
    const inWindow = Math.abs(positionOffset) <= PLAYER_WINDOW_RADIUS;

    if (!inWindow) return false;
    if (isActive) return true;

    // MD §2.6.2：下一条须当前条 player 已计入窗口后再 init
    if (isNext && preloadNext) {
        return initializedPlayerCount > 0;
    }

    // 上一条：在窗口内且为 activeIndex-1
    if (positionOffset === -1) return true;

    return false;
}

export function getWindowIndices(activeIndex: number, total: number): number[] {
    if (total <= 0) return [];
    const indices: number[] = [];
    for (let offset = -PLAYER_WINDOW_RADIUS; offset <= PLAYER_WINDOW_RADIUS; offset++) {
        const idx = activeIndex + offset;
        if (idx >= 0 && idx < total) indices.push(idx);
    }
    return indices;
}
