import { create } from 'zustand';
export type SharePosterData = { url: string; title: string; coverUrl?: string; inviteCode?: string; reward?: boolean };
export const useSharePosterStore = create<{ data: SharePosterData | null; open: (data: SharePosterData) => void; close: () => void }>(set => ({ data: null, open: data => set({ data }), close: () => set({ data: null }) }));
export const openSharePoster = (data: SharePosterData) => {
    if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => undefined).finally(() => useSharePosterStore.getState().open(data));
    } else useSharePosterStore.getState().open(data);
};
