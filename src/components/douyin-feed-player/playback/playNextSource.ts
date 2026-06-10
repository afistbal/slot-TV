/**
 * 抖音H5滑动与播放逻辑分析.md §8.5.2 L12404-12427
 * 同槽位 URL 变化时优先 switchURL，避免 destroy 重建
 */
import type { XgPlayerHandle } from '../player/createXgPlayer';
import type { PlaybackMode } from '../types';
import { setNativeVideoSrc } from './setNativeVideoSrc';

export type SwitchSourceOptions = {
    autoplay?: boolean;
    mode: PlaybackMode;
};

type SwitchablePlayer = XgPlayerHandle['player'] & {
    switchURL?: (url: string) => Promise<unknown> | null;
};

export async function trySwitchPlayerUrl(
    player: XgPlayerHandle['player'],
    url: string,
    opts: SwitchSourceOptions,
): Promise<boolean> {
    if (!url) return false;

    if (opts.mode === 'native') {
        const video = player.video as HTMLVideoElement | undefined;
        if (!video) return false;
        try {
            setNativeVideoSrc(video, url, {
                autoplay: opts.autoplay ?? false,
                muted: true,
            });
            return true;
        } catch {
            return false;
        }
    }

    const switchUrl = (player as SwitchablePlayer).switchURL;
    if (typeof switchUrl !== 'function') return false;

    try {
        await switchUrl.call(player, url);
        if (opts.autoplay) {
            player.play().catch(() => undefined);
        } else {
            player.pause();
        }
        return true;
    } catch {
        return false;
    }
}
