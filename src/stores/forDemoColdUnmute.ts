import { create } from 'zustand';

import {
    markForDemoColdSessionConsumed,
    type ForDemoMountAutoplayFlags,
} from '@/pages/user/ForDemo/forDemoAutoplayPolicy';

type ForDemoColdUnmuteState = {
    fromHomeVideoPlayback: boolean;
    /** 冷启动首条：静音自动播，可出蒙层 */
    feedColdAutoplay: boolean;
    /** 是否允许展示「Click to unmute」蒙层 */
    coldUnmuteOverlay: boolean;
    /** 冷启动落页条位（/video URL 集数；/foryou 恒为 0） */
    coldLandingIndex: number;
    /** 用户点蒙层或滑离落页条后不再展示 */
    overlayDismissed: boolean;
    initFromMount: (flags: ForDemoMountAutoplayFlags) => void;
    setColdLandingIndex: (index: number) => void;
    dismissOverlay: () => void;
    consumeColdAutoplay: () => void;
};

export const useForDemoColdUnmuteStore = create<ForDemoColdUnmuteState>((set) => ({
    fromHomeVideoPlayback: false,
    feedColdAutoplay: false,
    coldUnmuteOverlay: false,
    coldLandingIndex: 0,
    overlayDismissed: false,
    initFromMount: (flags) =>
        set({
            fromHomeVideoPlayback: flags.fromHomeVideoPlayback,
            feedColdAutoplay: flags.feedColdAutoplay,
            coldUnmuteOverlay: flags.feedColdAutoplay,
            coldLandingIndex: 0,
            overlayDismissed: false,
        }),
    setColdLandingIndex: (index) => set({ coldLandingIndex: index }),
    dismissOverlay: () => {
        markForDemoColdSessionConsumed();
        set({
            overlayDismissed: true,
            coldUnmuteOverlay: false,
            feedColdAutoplay: false,
        });
    },
    consumeColdAutoplay: () => {
        markForDemoColdSessionConsumed();
        set({
            feedColdAutoplay: false,
            coldUnmuteOverlay: false,
            overlayDismissed: true,
        });
    },
}));
