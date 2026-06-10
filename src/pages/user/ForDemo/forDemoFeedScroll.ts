/** for-demo 壳层滚动 feed，不依赖 DouyinFeedPlayer ref */
export function scrollForDemoFeedToIndex(
    index: number,
    behavior: ScrollBehavior = 'smooth',
): void {
    const scroller = document.querySelector('.for-demo #sliderVideo') as HTMLElement | null;
    if (!scroller) return;
    const slide = scroller.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior, block: 'start' });
}
