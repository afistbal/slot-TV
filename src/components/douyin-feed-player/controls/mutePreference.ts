/** 对标抖音 H.J() / PLAYER_IS_MUTE（MD §4），独立 key 避免与 /video 耦合 */
const MUTE_KEY = 'douyin_feed_player_is_mute';

export function readMutedPreference(): boolean {
    try {
        const raw = localStorage.getItem(MUTE_KEY);
        if (raw === '0') return false;
        if (raw === '1') return true;
    } catch {
        /* ignore */
    }
    return true;
}

export function writeMutedPreference(muted: boolean): void {
    try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
        /* ignore */
    }
}
