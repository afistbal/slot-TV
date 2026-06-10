import { useCallback, useEffect, useRef, useState } from 'react';

import type Player from 'xgplayer';

import { PLAYBACK_SPEEDS } from '../constants';

import {
    applyPlaybackSpeed,
    cyclePlaybackSpeedIndex,
    formatPlaybackTime,
    getPlayerDuration,
    seekPlayer,
    togglePlayerFullscreen,
    togglePlayerMute,
    togglePlayerPlay,
} from './playerControlsApi';
import { readSpeedIndexPreference } from './speedPreference';
import { subscribePlayerControlState } from './subscribePlayerControlState';

export function useDouyinPlayerControlState(player: Player | null) {
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [speedIndex, setSpeedIndex] = useState(() =>
        readSpeedIndexPreference(PLAYBACK_SPEEDS.length - 1),
    );
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [progressDragging, setProgressDragging] = useState(false);
    const [progressHover, setProgressHover] = useState(false);

    const progressDraggingRef = useRef(progressDragging);
    progressDraggingRef.current = progressDragging;

    // MD-ref: mount 时 subscribePlayerControlState → player.on/off
    useEffect(() => {
        if (!player) {
            setPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            return;
        }

        const subscription = subscribePlayerControlState(player, {
            getProgressDragging: () => progressDraggingRef.current,
            onPlayingChange: setPlaying,
            onMutedChange: setMuted,
            onCurrentTimeChange: setCurrentTime,
            onDurationChange: setDuration,
            onFullscreenChange: setIsFullscreen,
        });

        setSpeedIndex(subscription.speedIndex);
        setMuted(subscription.muted);

        return subscription.dispose;
    }, [player]);

    const onTogglePlay = useCallback(async () => {
        const nowPlaying = await togglePlayerPlay(player);
        setPlaying(nowPlaying);
    }, [player]);

    const onToggleMute = useCallback(() => {
        const next = togglePlayerMute(player);
        setMuted(next);
    }, [player]);

    const onCycleSpeed = useCallback(() => {
        const next = cyclePlaybackSpeedIndex(speedIndex);
        setSpeedIndex(next);
        applyPlaybackSpeed(player, next);
    }, [player, speedIndex]);

    const onToggleFullscreen = useCallback(async () => {
        const fs = await togglePlayerFullscreen(player);
        setIsFullscreen(fs);
    }, [player]);

    const onSeekRatio = useCallback(
        (ratio: number) => {
            seekPlayer(player, ratio);
            setCurrentTime(getPlayerDuration(player) * ratio);
        },
        [player],
    );

    return {
        playing,
        muted,
        speedIndex,
        speedLabel: `${PLAYBACK_SPEEDS[speedIndex]}x`,
        currentLabel: formatPlaybackTime(currentTime),
        durationLabel: formatPlaybackTime(duration),
        progressRatio: duration > 0 ? currentTime / duration : 0,
        isFullscreen,
        progressDragging,
        progressHover,
        setProgressDragging,
        setProgressHover,
        onTogglePlay,
        onToggleMute,
        onCycleSpeed,
        onToggleFullscreen,
        onSeekRatio,
    };
}
