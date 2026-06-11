import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';

export function useFeedPlayerColdUnmuteVisible(activeIndex: number): boolean {
    const coldUnmuteOverlay = useForDemoColdUnmuteStore((s) => s.coldUnmuteOverlay);
    const overlayDismissed = useForDemoColdUnmuteStore((s) => s.overlayDismissed);
    const feedColdAutoplay = useForDemoColdUnmuteStore((s) => s.feedColdAutoplay);
    const coldLandingIndex = useForDemoColdUnmuteStore((s) => s.coldLandingIndex);

    return (
        activeIndex === coldLandingIndex &&
        feedColdAutoplay &&
        coldUnmuteOverlay &&
        !overlayDismissed
    );
}
