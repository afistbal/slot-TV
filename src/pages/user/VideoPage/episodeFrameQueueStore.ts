import { create } from 'zustand';

type Store = {
    framesById: Record<number, string>;
    setFrame: (episodeRowId: number, dataUrl: string) => void;
    clear: () => void;
};

/** 各集首帧 data URL：供 poster、邻格占位，以及「时帧图队列」浮层订阅 */
export const useEpisodeFrameQueueStore = create<Store>((set) => ({
    framesById: {},
    setFrame: (episodeRowId, dataUrl) => {
        if (!dataUrl) {
            return;
        }
        const id = Number(episodeRowId);
        set((s) => {
            if (s.framesById[id] === dataUrl) {
                return s;
            }
            return { framesById: { ...s.framesById, [id]: dataUrl } };
        });
    },
    clear: () => set({ framesById: {} }),
}));

export function getEpisodePeekFrame(episodeRowId: number): string | undefined {
    return useEpisodeFrameQueueStore.getState().framesById[Number(episodeRowId)];
}

export function setEpisodePeekFrame(episodeRowId: number, dataUrl: string): void {
    useEpisodeFrameQueueStore.getState().setFrame(episodeRowId, dataUrl);
}

export function clearEpisodePeekFrameCache(): void {
    useEpisodeFrameQueueStore.getState().clear();
}
