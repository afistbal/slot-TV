import type { IForYouFeedItem } from '@/types/foryouFeed';
import { resolveEpisodePlaybackUrls } from '@/pages/user/VideoPage/videoPlayerPlaybackUrls';
import { buildEpisodeFromFeedItem } from './foryouFeedUtils';
import { putEpisodeDetailCache } from '@/pages/user/VideoPage/episodeDetailCache';
import { evictPrewarmExcept, putPrewarmedVideo } from './foryouPrewarmPool';

const FORYOU_MEDIA_PRECONNECT_ID = 'foryou-media-preconnect';

/** 提前与 CDN 建连，略减每条 mp4 的 301/首包 RTT */
export function ensureForyouMediaPreconnect(staticBase: string): void {
    if (typeof document === 'undefined') {
        return;
    }
    const raw = String(staticBase ?? '').trim();
    if (!raw) {
        return;
    }
    let origin = '';
    try {
        origin = new URL(raw.startsWith('http') ? raw : `https://${raw}`).origin;
    } catch {
        return;
    }
    let link = document.getElementById(FORYOU_MEDIA_PRECONNECT_ID) as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement('link');
        link.id = FORYOU_MEDIA_PRECONNECT_ID;
        link.rel = 'preconnect';
        document.head.appendChild(link);
    }
    if (link.href !== origin) {
        link.href = origin;
    }
}

export function resolveFeedPlaybackUrls(item: IForYouFeedItem, staticBase: string): string[] {
    return resolveEpisodePlaybackUrls(buildEpisodeFromFeedItem(item), staticBase);
}

/** 取消当前 video 的 media 拉取（避免快速滑走时旧条占满连接队列） */
export function abortForyouVideoLoad(el: HTMLVideoElement | null | undefined): void {
    if (!el) {
        return;
    }
    el.pause();
    for (const source of el.querySelectorAll('source')) {
        source.removeAttribute('src');
    }
    el.removeAttribute('src');
    try {
        el.load();
    } catch {
        // ignore
    }
}

export function resolveFeedVideoUrl(item: IForYouFeedItem, staticBase: string): string | null {
    const urls = resolveFeedPlaybackUrls(item, staticBase);
    return urls[0] ?? null;
}

export type ForyouPrewarmMode = 'metadata' | 'auto';

/**
 * 隐藏 video 预拉（写入 pool，切条时可被播放器 adopt）。
 * @param mode `auto` 用于下一条邻格，多缓冲几秒媒体；`metadata` 用于更远的 +2。
 */
export function prewarmForyouFeedItem(
    item: IForYouFeedItem,
    staticBase: string,
    mode: ForyouPrewarmMode = 'metadata',
): () => void {
    putEpisodeDetailCache(item.ep_id, buildEpisodeFromFeedItem(item));
    ensureForyouMediaPreconnect(staticBase);
    const url = resolveFeedVideoUrl(item, staticBase);
    if (!url || typeof document === 'undefined') {
        return () => {};
    }
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = mode;
    v.setAttribute('playsinline', 'true');
    v.src = url;
    const onMeta = () => {
        putPrewarmedVideo(item.ep_id, url, v);
    };
    v.addEventListener('loadedmetadata', onMeta, { once: true });
    v.load();
    return () => {
        v.removeEventListener('loadedmetadata', onMeta);
    };
}

export function syncForyouPrewarmWindow(keepEpIds: number[]): void {
    evictPrewarmExcept(new Set(keepEpIds));
}

export { hasPrewarmedVideo, takePrewarmedVideo } from './foryouPrewarmPool';


