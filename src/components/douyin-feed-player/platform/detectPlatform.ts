/**
 * 抖音H5-iOS播放适配分析.md §7.1
 * xgplayer pre-build L1973-2003
 */
export function detectPlatform() {
    const ua = navigator.userAgent;
    const isIPad = /(?:iPad|PlayBook)/.test(ua);
    const isIPhone = /(?:iPhone)/.test(ua) && !isIPad;
    const isIOS = isIPhone || isIPad;
    const isG6Safari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const mseSupported =
        typeof MediaSource !== 'undefined' &&
        typeof MediaSource.isTypeSupported === 'function' &&
        MediaSource.isTypeSupported('video/mp4; codecs="avc1.640028"');

    return {
        isIOS,
        isIPhone,
        isIPad,
        isG6Safari,
        mseSupported,
    };
}
