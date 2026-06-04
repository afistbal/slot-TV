import type { IForYouFeedItem } from '@/types/foryouFeed';
import { resolveEpisodePlaybackUrls } from '@/pages/user/VideoPage/videoPlayerPlaybackUrls';
import { buildEpisodeFromFeedItem } from './foryouFeedUtils';
import { putEpisodeDetailCache } from '@/pages/user/VideoPage/episodeDetailCache';
import { evictPrewarmExcept, putPrewarmedVideo } from './foryouPrewarmPool';

const FORYOU_MEDIA_PRECONNECT_ID = 'foryou-media-preconnect';
const FORYOU_MEDIA_DNS_PREFETCH_ID = 'foryou-media-dns-prefetch';

function upsertHeadLink(id: string, rel: string, href: string): void {
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = rel;
        document.head.appendChild(link);
    }
    if (link.href !== href) {
        link.href = href;
    }
}

/** 提前与 CDN 建连，略减每条 mp4 的 301/首包 RTT 与 TLS 握手 */
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
    upsertHeadLink(FORYOU_MEDIA_DNS_PREFETCH_ID, 'dns-prefetch', origin);
    upsertHeadLink(FORYOU_MEDIA_PRECONNECT_ID, 'preconnect', origin);
    const preconnect = document.getElementById(FORYOU_MEDIA_PRECONNECT_ID) as HTMLLinkElement | null;
    if (preconnect) {
        preconnect.crossOrigin = 'anonymous';
    }
}

export function resolveFeedPlaybackUrls(item: IForYouFeedItem, staticBase: string): string[] {
    return resolveEpisodePlaybackUrls(buildEpisodeFromFeedItem(item), staticBase);
}

/**
 * `abortForyouVideoLoad` 会手改 DOM 上的 `<source src>`，React 未必会再写回。
 * 从 paused 回到 autoplay（尤其 PC 向上切条）前需把 src 与 media 拉取对齐。
 */
/** 邻格 paused + preload=auto：对齐源并触发浏览器继续拉媒体（不 play） */
export function primeForyouNeighborBuffer(el: HTMLVideoElement, urls: string[]): void {
    resyncForyouVideoSources(el, urls);
    if (el.preload !== 'auto') {
        el.preload = 'auto';
    }
    if (
        el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
        el.networkState !== HTMLMediaElement.NETWORK_LOADING
    ) {
        try {
            el.load();
        } catch {
            // ignore
        }
    }
}

export function resyncForyouVideoSources(
    el: HTMLVideoElement,
    urls: string[],
): void {
    if (!urls.length) {
        return;
    }
    const sources = Array.from(el.querySelectorAll('source'));
    let changed = false;
    urls.forEach((url, i) => {
        const node = sources[i];
        if (node) {
            if (node.getAttribute('src') !== url) {
                node.setAttribute('src', url);
                changed = true;
            }
            return;
        }
        const created = document.createElement('source');
        created.setAttribute('src', url);
        created.type = 'video/mp4';
        el.appendChild(created);
        changed = true;
    });
    const mountedEmpty = sources.length > 0 && sources.every((s) => !s.getAttribute('src'));
    if (changed || mountedEmpty) {
        try {
            el.load();
        } catch {
            // ignore
        }
    }
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
 * @param mode `auto` 用于下一条邻格，多缓冲几秒媒体；`metadata` 用于窗口外再下 1 条。
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


