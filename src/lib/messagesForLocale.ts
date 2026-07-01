import enMessages from '@/locales/en.json';

export type TIntlMessages = Record<string, string>;

type LocaleLoader = () => Promise<{ default: TIntlMessages }>;

const EN_MESSAGES = enMessages as TIntlMessages;

const LOCALE_LOADERS: Record<string, LocaleLoader> = {
    ar: () => import('@/locales/ar.json'),
    de: () => import('@/locales/de.json'),
    es: () => import('@/locales/es.json'),
    fr: () => import('@/locales/fr.json'),
    hi: () => import('@/locales/hi.json'),
    id: () => import('@/locales/id.json'),
    it: () => import('@/locales/it.json'),
    ja: () => import('@/locales/ja.json'),
    ko: () => import('@/locales/ko.json'),
    ms: () => import('@/locales/ms.json'),
    pt: () => import('@/locales/pt.json'),
    th: () => import('@/locales/th.json'),
    tr: () => import('@/locales/tr.json'),
    vi: () => import('@/locales/vi.json'),
    zh: () => import('@/locales/zh.json'),
};

const messagesCache = new Map<string, TIntlMessages>([['en', EN_MESSAGES]]);

function mergeWithEnglish(partial: TIntlMessages): TIntlMessages {
    return { ...EN_MESSAGES, ...partial };
}

/** 与 App / 语言页 `APP_LANGUAGES` 及 `localStorage.locale` 对齐 */
export function normalizeAppLocaleCode(code: string): string {
    const c = code.toLowerCase();
    if (
        c === 'zh' ||
        c === 'zh-hans' ||
        c === 'zh-hant' ||
        c === 'zh-tw' ||
        c === 'zh-cn' ||
        c.startsWith('zh-')
    ) {
        return 'zh';
    }
    if (c === 'en' || c in LOCALE_LOADERS) {
        return c;
    }
    return 'en';
}

export function messagesForLocale(code: string): TIntlMessages {
    return messagesCache.get(normalizeAppLocaleCode(code)) ?? EN_MESSAGES;
}

export async function loadMessagesForLocale(code: string): Promise<TIntlMessages> {
    const normalized = normalizeAppLocaleCode(code);
    const cached = messagesCache.get(normalized);
    if (cached) {
        return cached;
    }

    const loader = LOCALE_LOADERS[normalized];
    if (!loader) {
        return EN_MESSAGES;
    }

    const loaded = await loader();
    const messages = mergeWithEnglish(loaded.default);
    messagesCache.set(normalized, messages);
    return messages;
}
