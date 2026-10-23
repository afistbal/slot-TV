/**
 * 是否为 Apple 系环境（iOS / iPadOS / macOS）。
 * 用于选择 Apple Pay 等平台相关支付能力。
 */
export function isApplePlatform(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }
    const ua = navigator.userAgent;
    if (/iPhone|iPod|iPad/i.test(ua)) {
        return true;
    }
    // iPadOS 13+ 桌面模式常伪装为 Mac + 多点触控
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return true;
    }
    if (/Macintosh|Mac OS X/i.test(ua)) {
        return true;
    }
    return false;
}
