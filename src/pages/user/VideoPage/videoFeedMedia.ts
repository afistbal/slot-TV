const VIDEO_MEDIA_PRECONNECT_ID = 'video-media-preconnect';
const VIDEO_MEDIA_DNS_PREFETCH_ID = 'video-media-dns-prefetch';

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

/** 提前与 CDN 建连，略减每条 mp4 的 301/首包 RTT 与 TLS 握手（对标 foryouFeedMedia） */
export function ensureVideoMediaPreconnect(staticBase: string): void {
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
    upsertHeadLink(VIDEO_MEDIA_DNS_PREFETCH_ID, 'dns-prefetch', origin);
    upsertHeadLink(VIDEO_MEDIA_PRECONNECT_ID, 'preconnect', origin);
    const preconnect = document.getElementById(VIDEO_MEDIA_PRECONNECT_ID) as HTMLLinkElement | null;
    if (preconnect) {
        preconnect.crossOrigin = 'anonymous';
    }
}

/**
 * 手改 DOM 上的 `<source src>` 后，React 未必会再写回。
 * 从 paused 回到 autoplay 前需把 src 与 media 拉取对齐。
 */
export function resyncVideoSources(el: HTMLVideoElement, urls: string[]): void {
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

/** 邻格 paused + preload=auto：对齐源并触发浏览器继续拉媒体（不 play） */
export function primeVideoNeighborBuffer(el: HTMLVideoElement, urls: string[]): void {
    resyncVideoSources(el, urls);
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

/** 取消当前 video 的 media 拉取（快速切集时释放连接；窗口内 keepMedia 时不应调用） */
export function abortVideoLoad(el: HTMLVideoElement | null | undefined): void {
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
