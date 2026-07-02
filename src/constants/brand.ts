/**
 * 鍏ㄧ珯灞曠ず鐢ㄥ搧鐗屽悕涓庨潤鎬佽祫婧愯矾寰勩€?
 * 淇敼姝ゅ鍗冲彲鍚屾椤舵爮 Logo+瀛楁爣銆丗ooter 鐗堟潈閲岀殑绔欑偣鍚嶃€佸叧浜庨〉銆佸垎浜〉涓庡搧鐗岃棰戝脊绐楁爣棰樼瓑銆?
 */
export const BRAND_DISPLAY_NAME = import.meta.env.VITE_BRAND_DISPLAY_NAME || 'YogoShort';

export const BRAND_DOMAIN_DISPLAY = import.meta.env.VITE_BRAND_DOMAIN_DISPLAY || 'YogoShort.com';

export const BRAND_DESCRIPTION =
    import.meta.env.VITE_BRAND_DESCRIPTION || `Watch short dramas on ${BRAND_DISPLAY_NAME}.`;

export const BRAND_CONTACT_EMAIL = import.meta.env.VITE_BRAND_CONTACT_EMAIL || 'cs@yogoshort.net';

export const BRAND_COPYRIGHT_COMPANY =
    import.meta.env.VITE_BRAND_COPYRIGHT_COMPANY || 'WEISHOW LIMITED';

export const BRAND_COPYRIGHT_LINE_1 =
    `${BRAND_DISPLAY_NAME} | All Rights Reserved | 2026 ${BRAND_COPYRIGHT_COMPANY}`;

export const BRAND_LOGO_SRC = '/new-logo.png';

/** 椤舵爮鍝佺墝閾炬帴锛歀ogo + 瀛楁爣鍚堜竴鐨勬í鐗?WebP */
export const BRAND_TOPNAV_WORDMARK_SRC = `/web_logo.webp?v=${encodeURIComponent(__APP_VERSION__)}`;
export const BRAND_TOPNAV_WORDMARK_WIDTH = 280;
export const BRAND_TOPNAV_WORDMARK_HEIGHT = 80;

let brandTopnavWordmarkPreloaded = false;

/** 搴旂敤鍚姩鏃堕杞介《鏍忓瓧鏍囷紝閬垮厤璺敱鍒囨崲鍚?TopNav 閲嶆寕杞芥椂 logo 闂竴涓?*/
export function preloadBrandTopnavWordmark(): void {
    if (brandTopnavWordmarkPreloaded || typeof window === 'undefined') {
        return;
    }
    brandTopnavWordmarkPreloaded = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = BRAND_TOPNAV_WORDMARK_SRC;
}
