import { create } from 'zustand'

type TTheme = 'light' | 'dark';

interface IRoot {
    locale: string,
    theme: TTheme,
    setLocale: (locale: string) => void,
    setTheme: (theme: TTheme) => void,
}

export const useRootStore = create<IRoot>((set) => ({
    locale: localStorage.getItem('locale') ?? 'en',
    theme: 'light',
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
}));