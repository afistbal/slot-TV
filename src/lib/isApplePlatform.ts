/**
 * 是否为 Apple 系环境（iOS / iPadOS / macOS）。
 * 用于隐藏 Chromium「添加到桌面」PWA 底栏：Safari 无 beforeinstallprompt，且产品要求苹果端不展示该条。
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
