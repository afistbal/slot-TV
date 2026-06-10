/**
 * 统一挂载 MSE/native 播放辅助（水位 / 防卡 / GapJump）
 */
import type { PlaybackMode } from '../types';
import { attachIOSAntiStall } from './attachIOSAntiStall';
import { attachSafariGapJump } from './attachSafariGapJump';
import { attachBufferWaterLevel } from './bufferWaterLevel';

export function attachPlaybackHelpers(options: {
    video: HTMLVideoElement;
    mode: PlaybackMode;
    onDegradeToNative: (currentTime: number) => void;
    onStall?: (reason: string) => void;
}): () => void {
    const cleanups: Array<() => void> = [attachBufferWaterLevel(options.video)];

    if (options.mode === 'mse') {
        cleanups.push(
            attachIOSAntiStall(options.video, {
                onDegradeToNative: options.onDegradeToNative,
                onStall: options.onStall,
            }),
        );
        cleanups.push(attachSafariGapJump(options.video));
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
