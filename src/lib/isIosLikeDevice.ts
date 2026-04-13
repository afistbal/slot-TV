/** iPhone / iPod / iPad（含 iPadOS 桌面 UA）。不含纯 Mac 桌面。 */
export function isIosLikeDevice(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }
    const ua = navigator.userAgent;
    if (/iPhone|iPod|iPad/i.test(ua)) {
        return true;
    }
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return true;
    }
    return false;
}
