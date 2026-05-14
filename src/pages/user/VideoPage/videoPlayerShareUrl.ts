import { shareOrigin } from '@/env';

/** 当前播放页可被分享的 canonical URL（与原先 VideoPlayer#getCurrentShareUrl 一致） */
export function resolveVideoSharePageUrl(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const fallbackDevShareOrigin = 'https://testwww.yogoshort.com';
    const baseOrigin = (shareOrigin || (isLocalhost ? fallbackDevShareOrigin : '')).replace(/\/+$/, '');
    if (baseOrigin) {
        return `${baseOrigin}${path}`;
    }
    return window.location.href;
}

export function resolveVideoPosterUrl(staticBase: string, imagePath: string | undefined): string {
    if (!imagePath) {
        return '';
    }
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    return `${staticBase}/${imagePath}`;
}

export function buildVideoShareEmbedCode(pageUrl: string, showControls: boolean): string {
    const src = `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}show_controls=${showControls ? 'true' : 'false'}`;
    return `<iframe id="reelshort_player" width="600" height="400" src="${src}" title="ReelShort video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>`;
}
