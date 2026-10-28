import { create } from 'zustand';

export const useTopUpStore = create<{
    open: boolean;
    initialTab: 'coins' | 'vip';
    show: (tab?: 'coins' | 'vip') => void;
    close: () => void;
}>((set) => ({
    open: false,
    initialTab: 'coins',
    show: (tab = 'coins') => set({ open: true, initialTab: tab }),
    close: () => set({ open: false }),
}));

export function topUpTabForUrl(url: URL): 'coins' | 'vip' {
    return /\/membership\/?$/i.test(url.pathname) || url.searchParams.get('show_plans') === '1' ? 'vip' : 'coins';
}

/** Keep old bookmarks and recharge links on the shared in-place recharge flow. */
export function isTopUpUrl(url: URL): boolean {
    return /\/(?:shopping|membership)\/?$/i.test(url.pathname)
        || (/\/profile\/?$/i.test(url.pathname) && url.searchParams.get('tab') === 'topup');
}
