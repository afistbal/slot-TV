/**
 * 是否以「主屏幕图标 / PWA standalone」方式打开（无 Safari 地址栏等）。
 * iOS：`navigator.standalone`；通用：`display-mode: standalone` / `minimal-ui`。
 */
export function isStandaloneDisplay(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return true;
        }
        if (window.matchMedia('(display-mode: minimal-ui)').matches) {
            return true;
        }
    } catch {
        // ignore
    }
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true;
}
