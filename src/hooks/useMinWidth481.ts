import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 481px)';

function subscribe(onChange: () => void) {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
}

function getSnapshot() {
    return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
    return false;
}

/** 与 `min-width: 481` 断点一致；H5 为 ≤480。 */
export function useMinWidth481() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
