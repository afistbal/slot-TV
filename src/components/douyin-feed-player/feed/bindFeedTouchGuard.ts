/**
 * 抖音H5滑动与播放逻辑分析.md §2.3 + §2.5 syncInteraction
 */
import { markUserGesture, setUserTouching } from './userGesturePlay';

function isControlsTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('.douyin-player-controls'));
}

export function bindFeedTouchGuard(
    element: HTMLElement,
    onTouchEnd?: () => void,
    onTouchStart?: () => void,
) {
    const stopUnlessControls = (event: Event) => {
        if (isControlsTarget(event.target)) return;
        event.stopPropagation();
    };

    const onStart = (event: Event) => {
        if (isControlsTarget(event.target)) return;
        setUserTouching(true);
        onTouchStart?.();
    };

    const onMove = () => {
        markUserGesture();
    };

    const onEnd = (event: Event) => {
        if (isControlsTarget(event.target)) return;
        setUserTouching(false);
        markUserGesture();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                onTouchEnd?.();
            });
        });
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: true });
    element.addEventListener('touchend', onEnd, { passive: true });
    element.addEventListener('touchcancel', onEnd, { passive: true });
    element.addEventListener('mousedown', stopUnlessControls);
    element.addEventListener('pointerdown', stopUnlessControls);

    return () => {
        element.removeEventListener('touchstart', onStart);
        element.removeEventListener('touchmove', onMove);
        element.removeEventListener('touchend', onEnd);
        element.removeEventListener('touchcancel', onEnd);
        element.removeEventListener('mousedown', stopUnlessControls);
        element.removeEventListener('pointerdown', stopUnlessControls);
    };
}
