/** `/video` 挂载窗口：相对当前集仅保留上 1 / 下 1（不对齐全集 DOM） */
export const VIDEO_PLAYER_WINDOW_PREV = 1;

export const VIDEO_PLAYER_WINDOW_NEXT = 1;

export function isInVideoPlayerWindow(episodeIndex: number, activeIndex: number): boolean {
    return (
        episodeIndex >= activeIndex - VIDEO_PLAYER_WINDOW_PREV &&
        episodeIndex <= activeIndex + VIDEO_PLAYER_WINDOW_NEXT
    );
}

/** 有限三格 Swiper：始终只渲染 prev / current / next 三个 slide 槽位 */
export const VIDEO_FINITE_SWIPER_CENTER = 1;

export type VideoSlideSlot =
    | { kind: 'episode'; index: number }
    | { kind: 'placeholder' };

export function buildThreeSlideSlots(
    activeIndex: number,
    total: number,
): [VideoSlideSlot, VideoSlideSlot, VideoSlideSlot] {
    if (total <= 0) {
        return [
            { kind: 'placeholder' },
            { kind: 'placeholder' },
            { kind: 'placeholder' },
        ];
    }
    const clamped = Math.min(Math.max(0, activeIndex), total - 1);
    return [
        clamped > 0 ? { kind: 'episode', index: clamped - 1 } : { kind: 'placeholder' },
        { kind: 'episode', index: clamped },
        clamped < total - 1 ? { kind: 'episode', index: clamped + 1 } : { kind: 'placeholder' },
    ];
}
