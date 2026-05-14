import { useSyncExternalStore } from 'react';

/** 订阅 `pathname` 变化（含 `pushState`/`replaceState`），供 Router 外的壳层按路由切 UI。 */
function subscribe(onStoreChange: () => void) {
    if (typeof window === 'undefined') {
        return () => {};
    }
    window.addEventListener('popstate', onStoreChange);
    const h = window.history;
    const origPush = h.pushState.bind(h);
    const origReplace = h.replaceState.bind(h);
    h.pushState = (...args: Parameters<History['pushState']>) => {
        origPush(...args);
        onStoreChange();
    };
    h.replaceState = (...args: Parameters<History['replaceState']>) => {
        origReplace(...args);
        onStoreChange();
    };
    return () => {
        window.removeEventListener('popstate', onStoreChange);
        h.pushState = origPush;
        h.replaceState = origReplace;
    };
}

function getSnapshot() {
    return typeof window !== 'undefined' ? window.location.pathname : '';
}

function getServerSnapshot() {
    return '';
}

export function useWindowPathname(): string {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
