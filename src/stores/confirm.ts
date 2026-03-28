import { create } from 'zustand'


interface IConfig {
    open: boolean,
    callback?: () => Promise<void>,
    setOpen: (open: boolean) => void,
    show: (callback?: () => Promise<void>) => void,
    ok: () => void,
    cancel: () => void,
}

export const useConfirmStore = create<IConfig>((set, get) => ({
    open: false,
    callback: undefined,
    setOpen: (open) => set({ open }),
    show: (callback?: () => Promise<void>) => {
        set({ callback, open: true });
    },
    ok: () => {
        const callback = get().callback;
        if (callback) {
            callback().finally(() => {
                set({ open: false, callback: undefined });
            });
        }
    },
    cancel: () => {
        set({ open: false, callback: undefined });
    }
}));