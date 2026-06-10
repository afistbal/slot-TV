/**
 * 抖音H5-iOS播放适配分析.md §10.5
 */
export type IOSBrowserShell =
    | 'safari'
    | 'chrome'
    | 'firefox'
    | 'edge'
    | 'gsa'
    | 'weixin'
    | 'other';

export function detectIOSBrowser() {
    const ua = navigator.userAgent;
    const isIPad = /(?:iPad|PlayBook)/.test(ua);
    const isIPhone = /(?:iPhone)/.test(ua) && !isIPad;
    const isIOS = isIPhone || isIPad;

    let shell: IOSBrowserShell = 'other';
    if (/MicroMessenger/i.test(ua)) shell = 'weixin';
    else if (/CriOS/i.test(ua)) shell = 'chrome';
    else if (/FxiOS/i.test(ua)) shell = 'firefox';
    else if (/EdgiOS/i.test(ua)) shell = 'edge';
    else if (/GSA/i.test(ua)) shell = 'gsa';
    else if (isIOS) shell = 'safari';

    const isG6Safari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isStrictSafari =
        navigator.vendor === 'Apple Computer, Inc.' &&
        ua.includes('Safari/') &&
        !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/.test(ua);
    const isChrome =
        /CriOS/.test(ua) ||
        (!!(window as Window & { chrome?: unknown }).chrome && navigator.vendor === 'Google Inc.');

    const wk = ua.match(/AppleWebKit\/(\d+\.?\d*)/);

    return {
        isIOS,
        shell,
        isG6Safari,
        isStrictSafari,
        isChrome,
        webkitVersion: wk?.[1] ?? null,
    };
}
