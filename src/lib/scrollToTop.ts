/** 与 Ant Design `rc-util` scrollTo 相同的 easeInOutCubic（ReelShort BackTop 默认 duration=450） */
function easeInOutCubic(elapsed: number, start: number, end: number, duration: number): number {
    const change = end - start;
    let t = elapsed / (duration / 2);
    if (t < 1) {
        return (change / 2) * t * t * t + start;
    }
    t -= 2;
    return (change / 2) * (t * t * t + 2) + start;
}

/**
 * 将可滚动元素滚至顶部（与 antd FloatButton.BackTop 一致：450ms、cubic 缓动）。
 * 比 `scroll-behavior: smooth` / `behavior: 'smooth'` 更接近对方站点观感。
 */
export function scrollElementToTop(el: HTMLElement, durationMs = 450): void {
    const start = el.scrollTop;
    if (start <= 0) {
        return;
    }
    const t0 = Date.now();
    const step = () => {
        const elapsed = Date.now() - t0;
        const t = elapsed > durationMs ? durationMs : elapsed;
        const y = easeInOutCubic(t, start, 0, durationMs);
        el.scrollTop = y;
        if (elapsed < durationMs) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
}
