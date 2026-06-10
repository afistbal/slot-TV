import type Player from 'xgplayer';

import { FIXED_PLAYBACK_SPEED_INDEX, PLAYBACK_SPEEDS } from '../constants';

import { readMutedPreference } from './mutePreference';
import {
    applyPlaybackSpeed,
    applyPlayerMute,
    getPlayerCurrentTime,
    getPlayerDuration,
    isPlayerMuted,
    isPlayerPaused,
} from './playerControlsApi';
import { readSpeedIndexPreference } from './speedPreference';

export type PlayerControlSubscription = {
    dispose: () => void;
    speedIndex: number;
    muted: boolean;
};

export type SubscribePlayerControlStateOptions = {
    getProgressDragging: () => boolean;
    onPlayingChange: (playing: boolean) => void;
    onMutedChange: (muted: boolean) => void;
    onCurrentTimeChange: (time: number) => void;
    onDurationChange: (duration: number) => void;
    onFullscreenChange: (fullscreen: boolean) => void;
    /** 固定 1.0x，不读 localStorage */
    fixedPlaybackSpeed?: boolean;
};

/** MD-ref: 控件状态由 xgplayer 事件驱动，mount 时 on / unmount 时 off */
export function subscribePlayerControlState(
    player: Player,
    options: SubscribePlayerControlStateOptions,
): PlayerControlSubscription {
    const speedIndex = options.fixedPlaybackSpeed
        ? FIXED_PLAYBACK_SPEED_INDEX
        : readSpeedIndexPreference(PLAYBACK_SPEEDS.length - 1);
    applyPlaybackSpeed(player, speedIndex, !options.fixedPlaybackSpeed);

    const mutedPref = readMutedPreference();
    applyPlayerMute(player, mutedPref);

    const syncFromPlayer = () => {
        options.onPlayingChange(!isPlayerPaused(player));
        options.onMutedChange(isPlayerMuted(player));
        options.onCurrentTimeChange(getPlayerCurrentTime(player));
        options.onDurationChange(getPlayerDuration(player));
    };

    const onFsChange = () => {
        options.onFullscreenChange(Boolean(document.fullscreenElement));
    };

    const events = ['play', 'pause', 'loadedmetadata', 'durationchange', 'volumechange'] as const;
    events.forEach((ev) => player.on(ev, syncFromPlayer));

    const onTime = () => {
        if (!options.getProgressDragging()) {
            options.onCurrentTimeChange(getPlayerCurrentTime(player));
        }
    };
    player.on('timeupdate', onTime);

    document.addEventListener('fullscreenchange', onFsChange);
    syncFromPlayer();
    onFsChange();

    const dispose = () => {
        events.forEach((ev) => player.off(ev, syncFromPlayer));
        player.off('timeupdate', onTime);
        document.removeEventListener('fullscreenchange', onFsChange);
    };

    return { dispose, speedIndex, muted: mutedPref };
}
