import type { IForYouFeedItem } from '@/types/foryouFeed';
import { buildEpisodeFromFeedItem } from './foryouFeedUtils';
import { putEpisodeDetailCache } from '@/pages/user/VideoPage/episodeDetailCache';

export function resolveFeedVideoUrl(item: IForYouFeedItem, staticBase: string): string | null {
    const ep = buildEpisodeFromFeedItem(item);
    const videoStr = String(ep.video ?? '').trim();
    if (!videoStr) {
        return null;
    }
    if (videoStr.startsWith('http://') || videoStr.startsWith('https://')) {
        return videoStr;
    }
    const base = String(staticBase ?? '').replace(/\/+$/, '');
    if (!base) {
        return null;
    }
    return `${base}/${videoStr.replace(/^\/+/, '')}`;
}

/** 邻条预拉：写入 episode 缓存 + 隐藏 video 拉 metadata，加快切条起播 */
export function prewarmForyouFeedItem(item: IForYouFeedItem, staticBase: string): () => void {
    putEpisodeDetailCache(item.ep_id, buildEpisodeFromFeedItem(item));
    const url = resolveFeedVideoUrl(item, staticBase);
    if (!url || typeof document === 'undefined') {
        return () => {};
    }
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('playsinline', 'true');
    v.src = url;
    v.load();
    return () => {
        v.pause();
        v.removeAttribute('src');
        try {
            v.load();
        } catch {
            // ignore
        }
    };
}
