import { movieCoverUrl, type MovieCoverSource } from '@/lib/movieCoverUrl';

/** `document.head` 里用于首页 Banner 预加载的 `<link id>` 前缀 */
export const HOME_HERO_PRELOAD_LINK_ID_PREFIX = 'slot-home-hero-preload';

/** 对齐对站：首屏轮播前若干张并行预取，缩短 LCP 前等待 */
export const HOME_HERO_PRELOAD_MAX = 12;

export function clearHomeHeroPreloadLinks(): void {
    document
        .querySelectorAll(`link[id^="${HOME_HERO_PRELOAD_LINK_ID_PREFIX}"]`)
        .forEach((el) => {
            el.remove();
        });
}

/**
 * 在 `home` 接口返回后尽快调用：清理旧 link，再为前 `HOME_HERO_PRELOAD_MAX` 张 Banner 注入 `preload`。
 */
export function applyHomeHeroPreloadLinks(
    staticBase: string,
    topItems: MovieCoverSource[],
): void {
    clearHomeHeroPreloadLinks();
    const n = Math.min(HOME_HERO_PRELOAD_MAX, topItems.length);
    for (let i = 0; i < n; i++) {
        const href = movieCoverUrl(topItems[i], staticBase) ?? '';
        if (!href) {
            continue;
        }
        const link = document.createElement('link');
        link.id = `${HOME_HERO_PRELOAD_LINK_ID_PREFIX}-${i}`;
        link.rel = 'preload';
        link.as = 'image';
        link.href = href;
        if (i === 0) {
            link.setAttribute('fetchpriority', 'high');
        }
        document.head.appendChild(link);
    }
}
