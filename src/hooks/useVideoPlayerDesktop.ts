import { useSyncExternalStore } from 'react';

/** 播放页 PC 壳断点：≥1040 才进桌面布局，避免大屏手机横屏（宽 844–932）误切 PC */
const QUERY = '(min-width: 1040px)';

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

export function useVideoPlayerDesktop() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
