/**
 * 与 `App.tsx` 的 `lazyPage(() => import('.../Profile'))` 等**同一路径**，复用同一 chunk。
 * 首屏不拉这些包；在 load 后 idle 或用户指向 Tab 时再拉，避免与首屏争带宽。
 */

let profileDone = false;
let searchDone = false;
let myListDone = false;
let luckyDone = false;
let affiliateDone = false;
let homeDone = false;
let forYouDone = false;
const intentPrefetches = new Map<string, Promise<unknown>>();

function prefetchIntentModule(key: string, loader: () => Promise<unknown>): void {
    if (intentPrefetches.has(key)) return;
    const request = loader().catch((reason) => {
        intentPrefetches.delete(key);
        throw reason;
    });
    intentPrefetches.set(key, request);
    void request.catch(() => undefined);
}

export function prefetchHomeRouteChunk(): void {
    if (homeDone) return;
    homeDone = true;
    void import('../pages/user/Home')
        .then(() => undefined)
        .catch(() => {
            homeDone = false;
        });
}

export function prefetchForYouRouteChunk(): void {
    if (forYouDone) return;
    forYouDone = true;
    void import('../pages/user/ForDemo')
        .then(() => undefined)
        .catch(() => {
            forYouDone = false;
        });
}

export function prefetchProfileRouteChunk(): void {
    if (profileDone) return;
    profileDone = true;
    void import('../pages/user/Profile')
        .then(() => undefined)
        .catch(() => {
            profileDone = false;
        });
}

export function prefetchSearchRouteChunk(): void {
    if (searchDone) return;
    searchDone = true;
    void import('../pages/user/Search')
        .then(() => undefined)
        .catch(() => {
            searchDone = false;
        });
}

export function prefetchMyListRouteChunk(): void {
    if (myListDone) return;
    myListDone = true;
    void import('../pages/user/MyList')
        .then(() => undefined)
        .catch(() => {
            myListDone = false;
        });
}

export function prefetchLuckyRouteChunk(): void {
    if (luckyDone) return;
    luckyDone = true;
    void import('../pages/user/Lucky')
        .then(() => undefined)
        .catch(() => {
            luckyDone = false;
        });
}

export function prefetchAffiliateRouteChunk(): void {
    if (affiliateDone) return;
    affiliateDone = true;
    void import('../pages/user/AffiliateProgram')
        .then(() => undefined)
        .catch(() => {
            affiliateDone = false;
        });
}

function routeWithoutLocale(pathname: string): string {
    const segments = pathname.toLowerCase().split('/').filter(Boolean);
    if (/^[a-z]{2}(?:-[a-z]{2,4})?$/.test(segments[0] ?? '')) segments.shift();
    return `/${segments.join('/')}`;
}

/** Match the same lazy imports used by App.tsx so browser module caching removes the navigation wait. */
export function prefetchUserRouteForPathname(pathname: string): void {
    const path = routeWithoutLocale(pathname);

    if (path === '/') return prefetchHomeRouteChunk();
    if (path === '/foryou' || path === '/for-you' || path === '/for-demo') return prefetchForYouRouteChunk();
    if (path === '/search' || path === '/tagsearch') return prefetchSearchRouteChunk();
    if (path === '/profile') return prefetchProfileRouteChunk();
    if (path === '/lucky') return prefetchLuckyRouteChunk();
    if (path === '/affiliate') return prefetchAffiliateRouteChunk();
    if (path === '/my-list' || path.startsWith('/my-list/')) {
        prefetchMyListRouteChunk();
        if (path.startsWith('/my-list/history')) {
            prefetchIntentModule('history', () => import('../pages/user/History'));
        } else {
            prefetchIntentModule('favorite', () => import('../pages/user/Favorite'));
        }
        return;
    }
    if (path.startsWith('/shelf/')) return prefetchIntentModule('shelf', () => import('../pages/user/Shelf'));
    if (path.startsWith('/drama/')) return prefetchIntentModule('drama', () => import('../pages/user/DramaDetail'));
    if (path.startsWith('/episodes/')) return prefetchIntentModule('episodes', () => import('../pages/user/Episodes'));
    if (path === '/shopping' || path === '/radix-rc') return prefetchIntentModule('shopping', () => import('../pages/user/RadixRc'));
    if (path === '/creator') return prefetchIntentModule('creator', () => import('../pages/user/CreatorProgram'));
    if (path === '/wallet') return prefetchIntentModule('wallet', () => import('../pages/user/Wallet'));
    if (path === '/user/detail') return prefetchIntentModule('user-detail', () => import('../pages/user/UserDetail'));
    if (path.startsWith('/video/') || path.startsWith('/v-demo/')) return prefetchIntentModule('video', () => import('../pages/user/VDemo'));
    if (path.startsWith('/share/')) return prefetchIntentModule('share', () => import('../pages/user/ShareToVideoRedirect'));
    if (path === '/page/feedback') return prefetchIntentModule('feedback', () => import('../pages/user/Feedback'));
    if (path === '/page/language') return prefetchIntentModule('language', () => import('../pages/user/Language'));
    if (path === '/page/about') return prefetchIntentModule('about', () => import('../pages/user/About'));
    if (path === '/page/text') return prefetchIntentModule('text', () => import('../pages/user/Text'));
    if (path === '/page/login') return prefetchIntentModule('login', () => import('../pages/user/Login'));
    if (path === '/page/ios-add-home') return prefetchIntentModule('ios-add-home', () => import('../pages/user/IosAddHomeGuide'));
    if (path === '/page/pay' || path.startsWith('/page/pay/')) return prefetchIntentModule('pay', () => import('../pages/user/Pay'));
    if (path === '/page/my-balance') return prefetchIntentModule('my-balance', () => import('../pages/user/MyBanlance'));
}

/**
 * Mirrors the benchmark's route-intent prefetch: hover briefly on desktop,
 * or touch an internal link on mobile, and its lazy route starts downloading
 * before React commits the navigation.
 */
export function installUserRouteIntentPrefetch(): () => void {
    let hoverTimer = 0;

    const internalPathname = (target: EventTarget | null): string | null => {
        if (!(target instanceof Element)) return null;
        const anchor = target.closest<HTMLAnchorElement>('a[href]');
        if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
        try {
            const url = new URL(anchor.href, window.location.href);
            return url.origin === window.location.origin ? url.pathname : null;
        } catch {
            return null;
        }
    };

    const onPointerEnter = (event: PointerEvent) => {
        const pathname = internalPathname(event.target);
        if (!pathname) return;
        if (hoverTimer) window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => {
            hoverTimer = 0;
            prefetchUserRouteForPathname(pathname);
        }, 65);
    };
    const onPointerLeave = (event: PointerEvent) => {
        if (!hoverTimer || !internalPathname(event.target)) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = 0;
    };
    const onTouchStart = (event: TouchEvent) => {
        const pathname = internalPathname(event.target);
        if (pathname) prefetchUserRouteForPathname(pathname);
    };

    document.addEventListener('pointerenter', onPointerEnter, { capture: true, passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { capture: true, passive: true });
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });

    return () => {
        if (hoverTimer) window.clearTimeout(hoverTimer);
        document.removeEventListener('pointerenter', onPointerEnter, true);
        document.removeEventListener('pointerleave', onPointerLeave, true);
        document.removeEventListener('touchstart', onTouchStart, true);
    };
}

/**
 * 首屏稳定后依次预热五个底部 Tab，再预热搜索/片单等次级页面。
 * 串行错峰，避免与首屏图片和接口争抢带宽。
 */
export function scheduleSecondaryUserRoutesPrefetch(): void {
    if (typeof window === 'undefined') return;

    const runIdle = (fn: () => void) => {
        // 用 typeof 判断：lib.dom 若把 requestIdleCallback 标成必存在，`in window` 会让 else 变成不可达分支，window 被收窄为 never
        if (typeof globalThis.requestIdleCallback === 'function') {
            globalThis.requestIdleCallback(() => fn(), { timeout: 12000 });
        } else {
            globalThis.setTimeout(fn, 350);
        }
    };

    const kick = () => {
        window.setTimeout(() => {
            runIdle(() => {
                // 搜索是顶栏最高频入口，先于次级 Tab 下载，避免首次点击才开始取 chunk。
                prefetchSearchRouteChunk();
                window.setTimeout(() => {
                    prefetchHomeRouteChunk();
                    window.setTimeout(() => {
                        prefetchProfileRouteChunk();
                        window.setTimeout(() => {
                            prefetchLuckyRouteChunk();
                            window.setTimeout(() => {
                                prefetchAffiliateRouteChunk();
                                window.setTimeout(() => {
                                    prefetchForYouRouteChunk();
                                    window.setTimeout(() => prefetchMyListRouteChunk(), 220);
                                }, 260);
                            }, 220);
                        }, 180);
                    }, 180);
                }, 160);
            });
        }, 800);
    };

    if (document.readyState === 'complete') {
        kick();
    } else {
        window.addEventListener('load', kick, { once: true });
    }
}
