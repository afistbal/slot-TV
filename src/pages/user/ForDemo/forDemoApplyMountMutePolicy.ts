import { lockUserAudio, unlockUserAudio } from '@/components/douyin-feed-player/feed/userGesturePlay';
import { writeMutedPreference } from '@/components/douyin-feed-player/controls/mutePreference';
import { hasVideoSessionUserUnmuted } from '@/pages/user/VideoPage/videoSessionMute';

import type { ForDemoMountAutoplayFlags } from './forDemoAutoplayPolicy';

/** 首 mount 前写入 douyin-feed-player 静音偏好（冷启静音 / 站内进入有声） */
export function applyForDemoMountMutePolicy(flags: ForDemoMountAutoplayFlags): void {
    if (flags.feedColdAutoplay) {
        writeMutedPreference(true);
        lockUserAudio();
        return;
    }
    if (flags.fromHomeVideoPlayback || hasVideoSessionUserUnmuted()) {
        writeMutedPreference(false);
        unlockUserAudio();
    }
}
