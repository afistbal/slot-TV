import { create } from 'zustand'
import { normalizeAppLocaleCode } from '@/lib/messagesForLocale';

type TTheme = 'light' | 'dark';

const initialLocale = normalizeAppLocaleCode(localStorage.getItem('locale') ?? 'zh-CN');
localStorage.setItem('locale', initialLocale);

interface IRoot {
    locale: string,
    theme: TTheme,
    /** Install entry visibility: native prompt when available, otherwise Android manual guide. */
    showInstallPrompt: boolean,
    /** `config` 完成后即渲染路由；此标记在 `login/token` 或 `login/anonymous` 成功后再为 true，供首页等依赖会话的请求 */
    sessionBootstrapReady: boolean,
    setLocale: (locale: string) => void,
    setTheme: (theme: TTheme) => void,
    setShowInstallPrompt: (show: boolean) => void,
    setSessionBootstrapReady: (ready: boolean) => void,
}

export const useRootStore = create<IRoot>((set) => ({
    locale: initialLocale,
    theme: 'light',
    showInstallPrompt: false,
    sessionBootstrapReady: false,
    setLocale: (locale) => {
        const normalizedLocale = normalizeAppLocaleCode(locale);
        set({ locale: normalizedLocale });
        localStorage.setItem('locale', normalizedLocale);
        document.body.style.direction = 'ltr';
    },
    setTheme: (theme) => set({ theme }),
    setShowInstallPrompt: (show) => set({ showInstallPrompt: show }),
    setSessionBootstrapReady: (ready) => set({ sessionBootstrapReady: ready }),
}));
