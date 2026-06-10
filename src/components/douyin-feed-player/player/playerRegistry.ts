import type Player from 'xgplayer';

/** instManager-lite — 按 awemeId 登记播放器（AUDIT v5 §十 / MD §8.1） */
const playersById = new Map<string, Player>();
let activeId: string | null = null;

function toKey(id: string | number): string {
    return String(id);
}

export function register(id: string | number, player: Player): void {
    playersById.set(toKey(id), player);
}

export function unregister(id: string | number): void {
    const key = toKey(id);
    playersById.delete(key);
    if (activeId === key) {
        activeId = null;
    }
}

export function get(id: string | number): Player | undefined {
    return playersById.get(toKey(id));
}

export function setActiveId(id: string | number | null): void {
    activeId = id == null ? null : toKey(id);
}

export function getActiveId(): string | null {
    return activeId;
}
