/**
 * 抖音H5滑动与播放逻辑分析.md §2.4
 * routes-route.ceffa524.js L3073-3087
 */
import { WHEEL_DEBOUNCE_MS, WHEEL_DELTA_THRESHOLD } from '../constants';

export type WheelNavigateResult = 'next' | 'prev' | null;

export function resolveWheelDirection(event: WheelEvent): -1 | 0 | 1 {
    const legacy = event as WheelEvent & { wheelDelta?: number; detail?: number };
    const raw =
        typeof legacy.wheelDelta === 'number'
            ? legacy.wheelDelta
            : event.deltaY !== 0
              ? -event.deltaY
              : -(legacy.detail ?? 0);
    return Math.max(-1, Math.min(1, raw)) as -1 | 0 | 1;
}

/** 排除横向滚轮 — MD §2.4 */
export function isVerticalWheel(event: WheelEvent): boolean {
    const legacy = event as WheelEvent & { wheelDelta?: number; wheelDeltaX?: number };
    const hasWheelDeltaX = legacy.wheelDeltaX !== undefined;
    const hasDeltaX = event.deltaX !== undefined;
    if (!hasWheelDeltaX && !hasDeltaX) return true;
    const absX = Math.abs(legacy.wheelDeltaX ?? event.deltaX ?? 0);
    const absY = Math.abs(legacy.wheelDelta ?? event.deltaY ?? 0);
    return absX < absY || !hasWheelDeltaX;
}

export type WheelNavigateController = {
    onNavigate: (direction: 'next' | 'prev') => void;
    dispose: () => void;
};

/** 绑定 wheel → changeNext/changePrev（含累积阈值 + 400ms 防抖） */
export function bindWheelNavigate(
    element: HTMLElement,
    onNavigate: (direction: 'next' | 'prev') => void,
): WheelNavigateController {
    let accumulated = 0;
    let locked = false;
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleUnlockAfterWheelIdle = () => {
        if (unlockTimer) clearTimeout(unlockTimer);
        unlockTimer = setTimeout(() => {
            locked = false;
            accumulated = 0;
            unlockTimer = null;
        }, WHEEL_DEBOUNCE_MS);
    };

    const handler = (event: WheelEvent) => {
        if (!isVerticalWheel(event)) return;

        const direction = resolveWheelDirection(event);
        if (direction === 0) return;

        const magnitude = Math.abs(
            event.deltaY || (event as WheelEvent & { wheelDelta?: number }).wheelDelta || 0,
        );

        if (locked) {
            accumulated = 0;
            scheduleUnlockAfterWheelIdle();
            return;
        }

        accumulated += magnitude;
        const shouldTrigger = accumulated > WHEEL_DELTA_THRESHOLD;
        scheduleUnlockAfterWheelIdle();

        if (!shouldTrigger) return;

        locked = true;
        accumulated = 0;
        onNavigate(direction < 0 ? 'next' : 'prev');
        scheduleUnlockAfterWheelIdle();
    };

    element.addEventListener('wheel', handler, { passive: true });

    return {
        onNavigate,
        dispose: () => {
            element.removeEventListener('wheel', handler);
            if (unlockTimer) clearTimeout(unlockTimer);
        },
    };
}
