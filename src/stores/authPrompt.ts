import { create } from 'zustand';

type AuthPromptState = {
    open: boolean;
    requestLogin: () => void;
    close: () => void;
};

export const useAuthPromptStore = create<AuthPromptState>((set) => ({
    open: false,
    requestLogin: () => set({ open: true }),
    close: () => set({ open: false }),
}));
