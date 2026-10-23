import zhCNMessages from '@/locales/zh-CN.json';
import { BRAND_DISPLAY_NAME, BRAND_DOMAIN_DISPLAY } from '@/constants/brand';

export type TIntlMessages = Record<string, string>;

type LocaleLoader = () => Promise<{ default: TIntlMessages }>;

const ZH_CN_MESSAGES = zhCNMessages as TIntlMessages;

const LOCALE_LOADERS: Record<string, LocaleLoader> = {
    'zh-TW': () => import('@/locales/zh-TW.json'),
};

function applyBrandMessages(messages: TIntlMessages): TIntlMessages {
    return {
        ...messages,
        site_name: BRAND_DISPLAY_NAME,
        domain: BRAND_DOMAIN_DISPLAY,
        vip: `${BRAND_DISPLAY_NAME} VIP`,
    };
}

const BRANDED_ZH_CN_MESSAGES = applyBrandMessages(ZH_CN_MESSAGES);

const messagesCache = new Map<string, TIntlMessages>([['zh-CN', BRANDED_ZH_CN_MESSAGES]]);

function mergeWithSimplifiedChinese(partial: TIntlMessages): TIntlMessages {
    return applyBrandMessages({ ...ZH_CN_MESSAGES, ...partial });
}

/** 与 App / 语言页 `APP_LANGUAGES` 及 `localStorage.locale` 对齐 */
export function normalizeAppLocaleCode(code: string): 'zh-CN' | 'zh-TW' {
    const c = code.trim().replace(/_/g, '-').toLowerCase();
    if (
        c === 'zh-hant' ||
        c === 'zh-tw' ||
        c === 'zh-hk' ||
        c === 'zh-mo' ||
        c.startsWith('zh-hant-')
    ) {
        return 'zh-TW';
    }
    // 舊版的 `zh` 代表繁體中文，保留既有使用者偏好。
    if (c === 'zh') return 'zh-TW';
    return 'zh-CN';
}

export function messagesForLocale(code: string): TIntlMessages {
    return messagesCache.get(normalizeAppLocaleCode(code)) ?? BRANDED_ZH_CN_MESSAGES;
}

export async function loadMessagesForLocale(code: string): Promise<TIntlMessages> {
    const normalized = normalizeAppLocaleCode(code);
    const cached = messagesCache.get(normalized);
    if (cached) {
        return cached;
    }

    const loader = LOCALE_LOADERS[normalized];
    if (!loader) {
        return BRANDED_ZH_CN_MESSAGES;
    }

    const loaded = await loader();
    const messages = mergeWithSimplifiedChinese(loaded.default);
    messagesCache.set(normalized, messages);
    return messages;
}
