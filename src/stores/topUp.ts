import { create } from 'zustand';

export const useTopUpStore = create<{
    open: boolean;
    show: () => void;
    close: () => void;
}>((set) => ({
    open: false,
    show: () => set({ open: true }),
    close: () => set({ open: false }),
}));

/** Keep old bookmarks and recharge links on the shared in-place recharge flow. */
export function isTopUpUrl(url: URL): boolean {
    return /\/(?:shopping|membership)\/?$/i.test(url.pathname)
        || (/\/profile\/?$/i.test(url.pathname) && url.searchParams.get('tab') === 'topup');
}
