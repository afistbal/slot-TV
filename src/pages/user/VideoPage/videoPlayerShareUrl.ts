import { shareOrigin } from '@/env';
import { movieCoverUrlFromInfo } from '@/lib/movieCoverUrl';

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

/** `movie/info` 剧封：`d.info` + `is_rename` */
export function resolveVideoPosterUrl(
    staticBase: string,
    info: { id?: number; image?: string; is_rename?: unknown } | undefined,
    fallbackMovieId?: number,
): string {
    return movieCoverUrlFromInfo(staticBase, info as Record<string, unknown>, fallbackMovieId) ?? '';
}

export function buildVideoShareEmbedCode(pageUrl: string, showControls: boolean): string {
    const src = `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}show_controls=${showControls ? 'true' : 'false'}`;
    return `<iframe id="reelshort_player" width="600" height="400" src="${src}" title="ReelShort video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>`;
}
