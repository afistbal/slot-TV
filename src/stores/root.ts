import { create } from 'zustand'

type TTheme = 'light' | 'dark';

interface IRoot {
    locale: string,
    theme: TTheme,
    showInstallPrompt: boolean,
    /** `config` 完成后即渲染路由；此标记在 `login/token` 或 `login/anonymous` 成功后再为 true，供首页等依赖会话的请求 */
    sessionBootstrapReady: boolean,
    setLocale: (locale: string) => void,
    setTheme: (theme: TTheme) => void,
    setShowInstallPrompt: (show: boolean) => void,
    setSessionBootstrapReady: (ready: boolean) => void,
}

export const useRootStore = create<IRoot>((set) => ({
    locale: localStorage.getItem('locale') ?? 'en',
    theme: 'light',
    showInstallPrompt: false,
    sessionBootstrapReady: false,
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
    setSessionBootstrapReady: (ready) => set({ sessionBootstrapReady: ready }),
}));