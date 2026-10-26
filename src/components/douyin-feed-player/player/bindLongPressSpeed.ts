/** Native capture listeners cover the picture AND its letterbox on both H5 feeds. */
export function bindLongPressSpeed(
    surface: HTMLElement,
    video: HTMLVideoElement,
    onSpeedingChange: (active: boolean) => void,
) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = false;
    let previousRate = 1;
    let startX = 0;
    let startY = 0;
    let suppressClickUntil = 0;
    let touchTracking = false;

    const clearTimer = () => {
        clearTimeout(timer);
        timer = undefined;
    };
    const stop = () => {
        clearTimer();
        if (!active) return;
        video.playbackRate = previousRate;
        active = false;
        delete surface.dataset.longPressSpeeding;
        delete video.dataset.longPressSpeeding;
        suppressClickUntil = Date.now() + 500;
        onSpeedingChange(false);
    };
    const isInteractive = (target: EventTarget | null) =>
        target instanceof Element && Boolean(target.closest(
            '.douyin-player-controls, .douyin-player-slot__landscape-fullscreen, a, input, textarea',
        ));
    const start = (x: number, y: number, target: EventTarget | null) => {
        if (isInteractive(target)) return;
        stop();
        startX = x;
        startY = y;
        timer = setTimeout(() => {
            timer = undefined;
            previousRate = video.playbackRate || 1;
            video.playbackRate = 2;
            active = true;
            surface.dataset.longPressSpeeding = 'true';
            video.dataset.longPressSpeeding = 'true';
            onSpeedingChange(true);
        }, 450);
    };
    const move = (x: number, y: number) => {
        if (Math.hypot(x - startX, y - startY) > 18) stop();
    };
    const pointerDown = (event: PointerEvent) => {
        // Safari supplies touch events even in WebViews with incomplete PointerEvent support.
        if (event.pointerType === 'touch' || event.button !== 0) return;
        start(event.clientX, event.clientY, event.target);
    };
    const pointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') move(event.clientX, event.clientY);
    };
    const pointerEnd = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') stop();
    };
    const touchStart = (event: TouchEvent) => {
        if (event.touches.length !== 1) { stop(); return; }
        touchTracking = true;
        const touch = event.touches[0];
        start(touch.clientX, touch.clientY, event.target);
    };
    const touchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (touchTracking && touch) move(touch.clientX, touch.clientY);
    };
    const touchEnd = (event: TouchEvent) => {
        touchTracking = false;
        if (active && event.cancelable) event.preventDefault();
        stop();
    };
    const click = (event: Event) => {
        if (Date.now() >= suppressClickUntil) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const contextMenu = (event: Event) => {
        if (!isInteractive(event.target)) event.preventDefault();
    };
    const visibilityChange = () => { if (document.hidden) stop(); };
    surface.addEventListener('pointerdown', pointerDown, true);
    surface.addEventListener('pointermove', pointerMove, true);
    window.addEventListener('pointerup', pointerEnd, true);
    window.addEventListener('pointercancel', pointerEnd, true);
    surface.addEventListener('touchstart', touchStart, { capture: true, passive: true });
    surface.addEventListener('touchmove', touchMove, { capture: true, passive: true });
    surface.addEventListener('touchend', touchEnd, { capture: true, passive: false });
    surface.addEventListener('touchcancel', touchEnd, true);
    surface.addEventListener('click', click, true);
    surface.addEventListener('contextmenu', contextMenu, true);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
        stop();
        surface.removeEventListener('pointerdown', pointerDown, true);
        surface.removeEventListener('pointermove', pointerMove, true);
        window.removeEventListener('pointerup', pointerEnd, true);
        window.removeEventListener('pointercancel', pointerEnd, true);
        surface.removeEventListener('touchstart', touchStart, true);
        surface.removeEventListener('touchmove', touchMove, true);
        surface.removeEventListener('touchend', touchEnd, true);
        surface.removeEventListener('touchcancel', touchEnd, true);
        surface.removeEventListener('click', click, true);
        surface.removeEventListener('contextmenu', contextMenu, true);
        window.removeEventListener('blur', stop);
        document.removeEventListener('visibilitychange', visibilityChange);
    };
}
