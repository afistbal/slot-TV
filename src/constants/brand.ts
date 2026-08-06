export const BRAND_DISPLAY_NAME = import.meta.env.VITE_BRAND_DISPLAY_NAME || 'YogoShort';

export const BRAND_DOMAIN_DISPLAY = import.meta.env.VITE_BRAND_DOMAIN_DISPLAY || 'YogoShort.com';

export const BRAND_DESCRIPTION =
    import.meta.env.VITE_BRAND_DESCRIPTION || `Watch short dramas on ${BRAND_DISPLAY_NAME}.`;

export const BRAND_CONTACT_EMAIL = import.meta.env.VITE_BRAND_CONTACT_EMAIL || 'cs@yogoshort.net';

export const BRAND_COPYRIGHT_COMPANY =
    (import.meta.env.VITE_BRAND_COPYRIGHT_COMPANY || '').trim();
export const BRAND_COPYRIGHT_YEAR = new Date().getFullYear();

const brandCopyrightSuffix = BRAND_COPYRIGHT_COMPANY
    ? import.meta.env.VITE_BRAND_COPYRIGHT_COMPANY_BEFORE_YEAR === 'true'
        ? `${BRAND_COPYRIGHT_COMPANY} ${BRAND_COPYRIGHT_YEAR}`
        : `${BRAND_COPYRIGHT_YEAR} ${BRAND_COPYRIGHT_COMPANY}`
    : `${BRAND_COPYRIGHT_YEAR}`;

export const BRAND_COPYRIGHT_LINE_1 =
    `${BRAND_DISPLAY_NAME} | All Rights Reserved | ${brandCopyrightSuffix}`;

function normalizePublicBase(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    if (/^(?:https?:)?\/\//i.test(trimmed)) {
        return trimmed.replace(/\/+$/, '');
    }
    return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function joinPublicAsset(base: string, file: string): string {
    const normalizedBase = normalizePublicBase(base);
    const normalizedFile = file.replace(/^\/+/, '');
    if (!normalizedBase) {
        return `/${normalizedFile}`;
    }
    return `${normalizedBase}/${normalizedFile}`;
}

function resolveBrandAsset(value: string | undefined, fallback: string): string {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return fallback;
    }
    if (/^(?:https?:)?\/\//i.test(trimmed) || trimmed.startsWith('/')) {
        return trimmed;
    }
    return joinPublicAsset(BRAND_ASSET_BASE, trimmed);
}

function versionedAsset(src: string): string {
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}v=${encodeURIComponent(__APP_VERSION__)}`;
}

function legalSiteUrlFromDomainDisplay(domainDisplay: string): string {
    const domain = domainDisplay
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '')
        .toLowerCase();
    if (!domain) {
        return 'https://www.yogoshort.com';
    }
    return `https://${domain.startsWith('www.') ? domain : `www.${domain}`}`;
}

export const BRAND_ASSET_BASE = normalizePublicBase(
    import.meta.env.VITE_BRAND_ASSET_BASE || '/brands/yogoshort',
);
export const BRAND_LEGAL_SITE_URL =
    import.meta.env.VITE_BRAND_LEGAL_SITE_URL || legalSiteUrlFromDomainDisplay(BRAND_DOMAIN_DISPLAY);

export const BRAND_LOGO_SRC = versionedAsset(joinPublicAsset(BRAND_ASSET_BASE, 'new-logo.png'));
export const BRAND_FAVICON_SRC = versionedAsset(joinPublicAsset(BRAND_ASSET_BASE, 'favorite.png'));

/** Top navigation wordmark: icon plus brand text, 280x80 WebP. */
export const BRAND_TOPNAV_WORDMARK_SRC = versionedAsset(joinPublicAsset(BRAND_ASSET_BASE, 'web_logo.webp'));
export const BRAND_TOPNAV_WORDMARK_WIDTH = 280;
export const BRAND_TOPNAV_WORDMARK_HEIGHT = 80;
export const BRAND_BOTTOM_TAB_ADD_ICON_SRC = versionedAsset(
    joinPublicAsset(BRAND_ASSET_BASE, 'bottom-tab/icon_logo@2x.webp'),
);
export const BRAND_COVER_PLACEHOLDER_LOGO_SRC = versionedAsset(
    joinPublicAsset(BRAND_ASSET_BASE, 'img_logo@2x.webp'),
);
export const BRAND_COIN_ICON_SRC = versionedAsset(
    resolveBrandAsset(
        import.meta.env.VITE_BRAND_COIN_ICON_SRC,
        joinPublicAsset(BRAND_ASSET_BASE, 'profile/icon_coin@2x.png'),
    ),
);

let brandTopnavWordmarkPreloaded = false;

export function preloadBrandTopnavWordmark(): void {
    if (brandTopnavWordmarkPreloaded || typeof window === 'undefined') {
        return;
    }
    brandTopnavWordmarkPreloaded = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = BRAND_TOPNAV_WORDMARK_SRC;
}
