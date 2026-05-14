/** 将秒数格式化为 mm:ss（与 douyin `_duration` 展示粒度一致） */
export function formatVideoClock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '00:00';
    }
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
