/** PC 滚轮：一次连续滚动（停稳前）最多 1 条/集；与 delta 累加、圈数无关 */
export type BindVerticalPcWheelNavOptions = {
    onPrev: () => void;
    onNext: () => void;
    shouldIgnore?: (e: WheelEvent) => boolean;
    /** 忽略噪声（触控板微动） */
    minAbsDelta?: number;
    /** 无新 wheel 多久后才允许下一次切换 */
    gestureIdleMs?: number;
};

const DEFAULT_MIN_ABS_DELTA = 1;
/** 机械滚轮一圈内常有短暂停顿，略长以免误解锁 */
const DEFAULT_GESTURE_IDLE_MS = 550;

export function bindVerticalPcWheelNav(
    el: HTMLElement,
    opts: BindVerticalPcWheelNavOptions,
): () => void {
    const minAbsDelta = opts.minAbsDelta ?? DEFAULT_MIN_ABS_DELTA;
    const gestureIdleMs = opts.gestureIdleMs ?? DEFAULT_GESTURE_IDLE_MS;
    let gestureLocked = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const unlockGesture = () => {
        gestureLocked = false;
        idleTimer = null;
    };

    const scheduleUnlock = () => {
        if (idleTimer) {
            clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(unlockGesture, gestureIdleMs);
    };

    const onWheel = (e: WheelEvent) => {
        if (opts.shouldIgnore?.(e)) {
            return;
        }
        scheduleUnlock();

        if (gestureLocked) {
            return;
        }

        const dy = e.deltaY;
        if (Math.abs(dy) < minAbsDelta) {
            return;
        }

        gestureLocked = true;
        if (dy > 0) {
            opts.onNext();
        } else {
            opts.onPrev();
        }
    };

    el.addEventListener('wheel', onWheel, { passive: true, capture: true });
    return () => {
        el.removeEventListener('wheel', onWheel, { capture: true });
        if (idleTimer) {
            clearTimeout(idleTimer);
        }
    };
}
