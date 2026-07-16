import { create } from 'zustand';

type VideoFavoriteState = {
    overrides: Record<string, boolean>;
    setOverride: (movieId: number, favorite: boolean) => void;
    clear: () => void;
};

function movieFavoriteKey(movieId: number): string | null {
    const id = Number(movieId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }
    return String(id);
}

export const useVideoFavoriteStore = create<VideoFavoriteState>((set) => ({
    overrides: {},
    setOverride: (movieId, favorite) => {
        const key = movieFavoriteKey(movieId);
        if (key == null) {
            return;
        }
        set((state) => ({
            overrides: {
                ...state.overrides,
                [key]: favorite,
            },
        }));
    },
    clear: () => set({ overrides: {} }),
}));

export function getVideoFavoriteOverride(movieId: number): boolean | undefined {
    const key = movieFavoriteKey(movieId);
    if (key == null) {
        return undefined;
    }
    return useVideoFavoriteStore.getState().overrides[key];
}

export function resolveVideoFavorite(movieId: number, backendFavorite: boolean): boolean {
    return getVideoFavoriteOverride(movieId) ?? backendFavorite;
}

export function setVideoFavoriteOverride(movieId: number, favorite: boolean): void {
    useVideoFavoriteStore.getState().setOverride(movieId, favorite);
}
