/**
 * QD: 9085-44814131bc0a1f4a.js L499（模块 79462 内函数 A）
 * 触摸目标在 xgplayer 控件内时不触发 Feed 滑动。
 */
export function isQdControlTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
        target.closest('.xgplayer-controls') ||
            target.closest('.xgplayer-progress') ||
            target.closest('.xgplayer-progress-bar') ||
            target.closest('.xgplayer-progress-played') ||
            target.closest('.xgplayer-progress-dot') ||
            target.closest('.xgplayer-progress-cache') ||
            target.closest('.xgplayer-progress-btn') ||
            target.closest('.xgplayer-volume') ||
            target.closest('.xgplayer-play') ||
            target.closest('.xgplayer-pause') ||
            target.closest('.xgplayer-fullscreen') ||
            target.closest('.xgplayer-texttrack') ||
            target.closest('.xgplayer-playbackrate'),
    );
}
