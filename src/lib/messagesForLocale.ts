import enMessages from '@/locales/en.json';
import zhMessages from '@/locales/zh.json';
import arMessages from '@/locales/ar.json';
import deMessages from '@/locales/de.json';
import idMessages from '@/locales/id.json';
import jaMessages from '@/locales/ja.json';
import koMessages from '@/locales/ko.json';
import msMessages from '@/locales/ms.json';
import ptMessages from '@/locales/pt.json';
import thMessages from '@/locales/th.json';
import trMessages from '@/locales/tr.json';
import viMessages from '@/locales/vi.json';

export type TIntlMessages = Record<string, string>;

function mergeWithEnglish(partial: TIntlMessages): TIntlMessages {
    return { ...enMessages, ...partial };
}

const MESSAGES_BY_CODE: Record<string, TIntlMessages> = {
    en: enMessages as TIntlMessages,
    zh: zhMessages as TIntlMessages,
    ar: mergeWithEnglish(arMessages as TIntlMessages),
    de: mergeWithEnglish(deMessages as TIntlMessages),
    id: mergeWithEnglish(idMessages as TIntlMessages),
    ja: mergeWithEnglish(jaMessages as TIntlMessages),
    ko: mergeWithEnglish(koMessages as TIntlMessages),
    ms: mergeWithEnglish(msMessages as TIntlMessages),
    pt: mergeWithEnglish(ptMessages as TIntlMessages),
    th: mergeWithEnglish(thMessages as TIntlMessages),
    tr: mergeWithEnglish(trMessages as TIntlMessages),
    vi: mergeWithEnglish(viMessages as TIntlMessages),
};

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
    if (c in MESSAGES_BY_CODE) {
        return c;
    }
    return 'en';
}

export function messagesForLocale(code: string): TIntlMessages {
    return MESSAGES_BY_CODE[normalizeAppLocaleCode(code)] ?? MESSAGES_BY_CODE.en;
}
