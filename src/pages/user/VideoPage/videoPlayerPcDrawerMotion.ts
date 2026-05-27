/** PC 抽屉 / 舞台左移 — 与 video-vertical.scss 保持一致 */
export const PC_DRAWER_DURATION_MS = 480;
export const PC_DRAWER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** 先绘制起始态，下一帧再进入终态，CSS transition 才能生效 */
export function schedulePcDrawerEnterFrame(callback: () => void): () => void {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(callback);
    });
    return () => {
        cancelAnimationFrame(outer);
        if (inner) {
            cancelAnimationFrame(inner);
        }
    };
}
