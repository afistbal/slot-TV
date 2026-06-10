const SPEED_INDEX_KEY = 'douyin_feed_playback_speed_index';

export function readSpeedIndexPreference(maxIndex: number): number {
    try {
        const raw = localStorage.getItem(SPEED_INDEX_KEY);
        if (raw == null) return 1;
        const idx = Number.parseInt(raw, 10);
        if (Number.isFinite(idx) && idx >= 0 && idx <= maxIndex) return idx;
    } catch {
        /* ignore */
    }
    return 1;
}

export function writeSpeedIndexPreference(index: number): void {
    try {
        localStorage.setItem(SPEED_INDEX_KEY, String(index));
    } catch {
        /* ignore */
    }
}
