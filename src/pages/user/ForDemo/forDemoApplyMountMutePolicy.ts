import { lockUserAudio, unlockUserAudio } from '@/components/douyin-feed-player/feed/userGesturePlay';
import { writeMutedPreference } from '@/components/douyin-feed-player/controls/mutePreference';
import { hasVideoSessionUserUnmuted } from '@/components/video-player/videoSessionMute';

import {
    isForDemoColdSessionConsumed,
    type ForDemoMountAutoplayFlags,
} from './forDemoAutoplayPolicy';

/** �?mount 前写�?douyin-feed-player 静音偏好（冷启静�?/ 站内进入有声�?*/
export function applyForDemoMountMutePolicy(flags: ForDemoMountAutoplayFlags): void {
    if (flags.feedColdAutoplay) {
        writeMutedPreference(true);
        lockUserAudio();
        return;
    }
    if (
        flags.fromHomeVideoPlayback ||
        hasVideoSessionUserUnmuted() ||
        isForDemoColdSessionConsumed()
    ) {
        writeMutedPreference(false);
        unlockUserAudio();
    }
}
