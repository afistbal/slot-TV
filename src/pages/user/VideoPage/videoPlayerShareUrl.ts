import { matchPath } from 'react-router';
import { shareOrigin } from '@/env';
import { movieCoverUrlFromInfo } from '@/lib/movieCoverUrl';

const SHARE_EPISODE_QUERY_KEY = 'v';

function resolveShareSiteOrigin(): string {
    return (shareOrigin || 'https://yogoshort.com').replace(/\/+$/, '');
}

function parseEpisodeFromVideoUrl(): { movieId?: string; episode?: string } {
    if (typeof window === 'undefined') {
        return {};
    }
    const videoMatch = matchPath({ path: '/video/:id/:episode?', end: true }, window.location.pathname);
    if (videoMatch?.params?.id == null) {
        return {};
    }
    const ep = videoMatch.params.episode?.trim();
    return {
        movieId: String(videoMatch.params.id),
        episode: ep || undefined,
    };
}

/** 分享链接：`https://yogoshort.com/share/{剧id}?v={集数}` */
export function resolveVideoSharePageUrl(movieId?: string | number, episode?: string | number): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const fromUrl = parseEpisodeFromVideoUrl();
    const id = movieId ?? fromUrl.movieId;
    const ep = episode != null ? String(episode).trim() : fromUrl.episode;
    if (id == null || !ep) {
        return '';
    }
    const params = new URLSearchParams();
    params.set(SHARE_EPISODE_QUERY_KEY, ep);
    return `${resolveShareSiteOrigin()}/share/${id}?${params.toString()}`;
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
