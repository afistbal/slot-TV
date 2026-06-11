import { useCallback } from 'react';

import {
    getActiveFeedPlayerId,
    getFeedPlayerById,
} from '@/components/douyin-feed-player';
import {
    isPlayerMuted,
    isPlayerPaused,
    togglePlayerMute,
} from '@/components/douyin-feed-player/controls/playerControlsApi';
import { writeMutedPreference } from '@/components/douyin-feed-player/controls/mutePreference';
import { markUserGesture, unlockUserAudio } from '@/components/douyin-feed-player/feed/userGesturePlay';
import { markVideoSessionUserUnmuted } from '@/components/video-player/videoSessionMute';
import { useForDemoColdUnmuteStore } from '@/stores/forDemoColdUnmute';

export function useFeedPlayerTapToUnmute() {
    return useCallback(() => {
        markUserGesture();
        markVideoSessionUserUnmuted();
        unlockUserAudio();
        writeMutedPreference(false);

        const activeId = getActiveFeedPlayerId();
        const player = activeId != null ? getFeedPlayerById(activeId) ?? null : null;
        if (player) {
            if (isPlayerMuted(player)) {
                togglePlayerMute(player);
            }
            if (isPlayerPaused(player)) {
                void player.play().catch(() => undefined);
            }
        }

        useForDemoColdUnmuteStore.getState().dismissOverlay();
    }, []);
}
