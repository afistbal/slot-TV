const V_DEMO_SCROLLER_SELECTOR = '.v-demo #sliderVideo';
const SCROLL_SETTLE_FALLBACK_MS = 400;

/** H5 壳层滚动 feed 到指定集（DouyinFeedPlayer 深链不自动 scroll） */
export function scrollVDemoFeedToIndex(
    index: number,
    behavior: ScrollBehavior = 'auto',
): void {
    const scroller = document.querySelector(V_DEMO_SCROLLER_SELECTOR) as HTMLElement | null;
    if (!scroller) {
        return;
    }
    const slide = scroller.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior, block: 'start' });
}

/**
 * iOS scroll-snap 惯性结束后再跑壳层副作用（navigate / batch / chrome）。
 * 优先 scrollend；不支持时用 rAF + timeout 兜底。
 */
export function scheduleVDemoFeedScrollSettled(run: () => void): () => void {
    const scroller = document.querySelector(V_DEMO_SCROLLER_SELECTOR) as HTMLElement | null;
    if (!scroller) {
        const id = window.setTimeout(run, SCROLL_SETTLE_FALLBACK_MS);
        return () => clearTimeout(id);
    }

    let settled = false;
    let fallbackId = 0;

    const finish = () => {
        if (settled) {
            return;
        }
        settled = true;
        scroller.removeEventListener('scrollend', finish);
        clearTimeout(fallbackId);
        run();
    };

    scroller.addEventListener('scrollend', finish, { once: true });
    fallbackId = window.setTimeout(finish, SCROLL_SETTLE_FALLBACK_MS);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const height = scroller.clientHeight || window.innerHeight;
            if (height <= 0) {
                return;
            }
            const idx = Math.round(scroller.scrollTop / height);
            const targetTop = idx * height;
            if (Math.abs(scroller.scrollTop - targetTop) < 2) {
                finish();
            }
        });
    });

    return () => {
        if (settled) {
            return;
        }
        settled = true;
        scroller.removeEventListener('scrollend', finish);
        clearTimeout(fallbackId);
    };
}
