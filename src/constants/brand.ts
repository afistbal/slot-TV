/**
 * 全站展示用品牌名与静态资源路径。
 * 修改此处即可同步顶栏 Logo+字标、Footer 版权里的站点名、关于页、分享页与品牌视频弹窗标题等。
 */
export const BRAND_DISPLAY_NAME = 'YogoShort';

export const BRAND_LOGO_SRC = '/new-logo.png';

/** 顶栏品牌链接：Logo + 字标合一的横版 WebP */
export const BRAND_TOPNAV_WORDMARK_SRC = '/web_logo.webp';
export const BRAND_TOPNAV_WORDMARK_WIDTH = 280;
export const BRAND_TOPNAV_WORDMARK_HEIGHT = 80;

let brandTopnavWordmarkPreloaded = false;

/** 应用启动时预载顶栏字标，避免路由切换后 TopNav 重挂载时 logo 闪一下 */
export function preloadBrandTopnavWordmark(): void {
    if (brandTopnavWordmarkPreloaded || typeof window === 'undefined') {
        return;
    }
    brandTopnavWordmarkPreloaded = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = BRAND_TOPNAV_WORDMARK_SRC;
}
