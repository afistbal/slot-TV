import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';

export function useFeedPlayerColdUnmuteVisible(activeIndex: number): boolean {
    const coldUnmuteOverlay = useForDemoColdUnmuteStore((s) => s.coldUnmuteOverlay);
    const overlayDismissed = useForDemoColdUnmuteStore((s) => s.overlayDismissed);
    const feedColdAutoplay = useForDemoColdUnmuteStore((s) => s.feedColdAutoplay);

    return (
        activeIndex === 0 &&
        feedColdAutoplay &&
        coldUnmuteOverlay &&
        !overlayDismissed
    );
}
