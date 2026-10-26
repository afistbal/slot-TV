import { useSyncExternalStore } from 'react';

/** Keep the existing desktop/tablet breakpoint; only phones stay H5 through rotation. */
const QUERY = '(min-width: 1040px)';

export function isPhonePlaybackDevice(): boolean {
    return /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(navigator.userAgent);
}

function subscribe(onChange: () => void) {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
}

function getSnapshot() {
    return !isPhonePlaybackDevice() && window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
    return false;
}

export function useVideoPlayerDesktop() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
