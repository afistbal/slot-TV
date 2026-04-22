import { create } from 'zustand'

type TTheme = 'light' | 'dark';

interface IRoot {
    locale: string,
    theme: TTheme,
    showInstallPrompt: boolean,
    setLocale: (locale: string) => void,
    setTheme: (theme: TTheme) => void,
    setShowInstallPrompt: (show: boolean) => void,
}

export const useRootStore = create<IRoot>((set) => ({
    locale: localStorage.getItem('locale') ?? 'en',
    theme: 'light',
    showInstallPrompt: false,
    setLocale: (locale) => {
        set({ locale });
        localStorage.setItem('locale', locale);
        if (locale === 'ar') {
            document.body.style.direction = 'rtl';
        } else {
            document.body.style.direction = 'ltr';
        }
    },
    setTheme: (theme) => set({ theme }),
    setShowInstallPrompt: (show) => set({ showInstallPrompt: show }),
}));