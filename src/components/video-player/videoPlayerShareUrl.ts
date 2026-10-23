import { matchPath } from 'react-router';
import { buildDramaShareUrl } from '@/lib/shareUrls';
import { movieCoverUrlFromInfo } from '@/lib/movieCoverUrl';

function parseMovieFromVideoUrl(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    const videoMatch = matchPath({ path: '/video/:id/:episode?', end: true }, window.location.pathname);
    return videoMatch?.params?.id;
}

/** For You 和视频页分享同一部剧的详情链接，不携带当前集数。 */
export function resolveVideoSharePageUrl(movieId?: string | number): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const id = movieId ?? parseMovieFromVideoUrl();
    if (id == null) {
        return '';
    }
    return buildDramaShareUrl(id);
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
