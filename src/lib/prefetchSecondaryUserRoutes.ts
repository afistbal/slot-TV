/**
 * 与 `App.tsx` 的 `lazyPage(() => import('.../Profile'))` 等**同一路径**，复用同一 chunk。
 * 首屏不拉这些包；在 load 后 idle 或用户指向 Tab 时再拉，避免与首屏争带宽。
 */

let profileDone = false;
let searchDone = false;
let myListDone = false;

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

/** load 完成后延迟 + idle，串行触发三条常用路由分包（间隔 ~200ms），降低并发连接争抢 */
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
                prefetchSearchRouteChunk();
                window.setTimeout(() => {
                    prefetchProfileRouteChunk();
                    window.setTimeout(() => prefetchMyListRouteChunk(), 220);
                }, 180);
            });
        }, 800);
    };

    if (document.readyState === 'complete') {
        kick();
    } else {
        window.addEventListener('load', kick, { once: true });
    }
}
