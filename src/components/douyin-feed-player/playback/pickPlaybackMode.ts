/**
 * 抖音H5-iOS播放适配分析.md §7.2
 * 对标 Mp4EncryptPlayer useVideoLoad / MP4_0
 */
import { isCrossOriginMediaUrl } from '../media/isCrossOriginMediaUrl';
import { detectPlatform } from '../platform/detectPlatform';
import type { PlaybackMode } from '../types';

export function pickPlaybackMode(opts: {
    isIOS: boolean;
    mseSupported: boolean;
    hasPreload: boolean;
    forceNative?: boolean;
    /** 跨域 CDN 无 CORS 时 MSE fetch 必失败，对标 _startDegradedPlayback 直链 */
    crossOriginMedia?: boolean;
}): PlaybackMode {
    if (opts.forceNative || !opts.mseSupported) return 'native';
    if (opts.crossOriginMedia) return 'native';
    // §2.1 no_preload → MP4_0 原生直链
    if (opts.isIOS && !opts.hasPreload) return 'native';
    return 'mse';
}

function isHlsUrl(url?: string): boolean {
    return Boolean(url && /\.m3u8(?:[?#]|$)/i.test(url));
}

export function resolvePlaybackMode(opts: {
    hasPreload: boolean;
    forceNative?: boolean;
    url?: string;
}): PlaybackMode {
    if (isHlsUrl(opts.url)) return 'native';
    const platform = detectPlatform();
    const crossOriginMedia = opts.url ? isCrossOriginMediaUrl(opts.url) : false;
    return pickPlaybackMode({
        isIOS: platform.isIOS,
        mseSupported: platform.mseSupported,
        hasPreload: opts.hasPreload,
        forceNative: opts.forceNative,
        crossOriginMedia,
    });
}
