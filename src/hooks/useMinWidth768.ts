import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

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

/** 与 Tailwind `md` 断点一致；仅客户端有准确值。 */
export function useMinWidth768() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
