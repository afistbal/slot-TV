/** H5 壳层滚动 feed 到指定集（DouyinFeedPlayer 深链不自动 scroll） */
export function scrollVDemoFeedToIndex(
    index: number,
    behavior: ScrollBehavior = 'auto',
): void {
    const scroller = document.querySelector('.v-demo #sliderVideo') as HTMLElement | null;
    if (!scroller) {
        return;
    }
    const slide = scroller.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior, block: 'start' });
}
