import { readMutedPreference } from '../controls/mutePreference';

/**
 * 抖音 MD §2.5 syncInteraction — iOS 需在用户手势窗口内 play()
 */
let gestureUntil = 0;
let lastGestureAt = 0;
let touching = false;
/** 用户曾主动取消静音 — iOS 切条不再 forceMute */
let audioUnlocked = false;

/** scroll-snap + mount 异步，iOS 手势窗需覆盖整段切条 */
export function markUserGesture(durationMs = 3000) {
    const now = Date.now();
    lastGestureAt = now;
    gestureUntil = now + durationMs;
}

export function setUserTouching(value: boolean) {
    touching = value;
    if (value) markUserGesture();
}

export function isUserGestureActive() {
    return touching || Date.now() < gestureUntil;
}

/** 切条后 mount / canplay 仍算「刚滑过」 */
export function isRecentUserInteraction(maxAgeMs = 4000) {
    return touching || Date.now() - lastGestureAt < maxAgeMs;
}

export function unlockUserAudio() {
    audioUnlocked = true;
}

export function lockUserAudio() {
    audioUnlocked = false;
}

export function isUserAudioUnlocked() {
    return audioUnlocked;
}

/** 刷新后 localStorage 已是有声偏好时恢复解锁态 */
export function syncAudioUnlockFromPreference() {
    if (!readMutedPreference()) unlockUserAudio();
}
