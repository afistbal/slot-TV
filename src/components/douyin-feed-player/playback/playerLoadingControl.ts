import type Player from 'xgplayer';

import { readMutedPreference } from '../controls/mutePreference';
import { resumeNativeVideo, suspendNativeVideo } from './suspendNativeVideo';

type Mp4PluginLike = {
    cancel?: () => void;
    mp4?: { cancelLoading?: () => void | Promise<void> };
};

/**
 * 失活槽：pause + 取消 native/MSE 进行中的拉流
 */
export function suspendPlayerLoading(player: Player): void {
    try {
        player.pause();
    } catch {
        /* ignore */
    }

    const video = player.video as HTMLVideoElement | undefined;
    if (video) {
        suspendNativeVideo(video);
    }

    try {
        const plugins = (player as Player & { plugins?: { mp4?: Mp4PluginLike; mp4Plugin?: Mp4PluginLike } })
            .plugins;
        const mp4 = plugins?.mp4 ?? plugins?.mp4Plugin;
        mp4?.cancel?.();
        void mp4?.mp4?.cancelLoading?.();
    } catch {
        /* ignore */
    }
}

/**
 * 激活槽：若 video 已无 src（曾 suspend），恢复拉流
 */
export function resumePlayerLoading(
    player: Player,
    url: string,
    opts?: { autoplay?: boolean },
): void {
    const video = player.video as HTMLVideoElement | undefined;
    if (!video || !url) return;

    const currentSrc = video.getAttribute('src') || video.src || '';
    if (!currentSrc) {
        resumeNativeVideo(video, url, {
            autoplay: opts?.autoplay,
            muted: readMutedPreference(),
        });
    }
}
