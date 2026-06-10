/** 壳层滚动 feed，不依赖 DouyinFeedPlayer ref */
export function scrollFeedPlayerToIndex(
    index: number,
    scopeSelector: string,
    behavior: ScrollBehavior = 'smooth',
): void {
    const scroller = document.querySelector(scopeSelector) as HTMLElement | null;
    if (!scroller) {
        return;
    }
    const slide = scroller.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior, block: 'start' });
}
