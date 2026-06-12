import { useCallback, useEffect, useRef, useState } from 'react';

import type Player from 'xgplayer';

import { FIXED_PLAYBACK_SPEED_INDEX, PLAYBACK_SPEEDS } from '../constants';

import {
    applyPlaybackSpeed,
    cyclePlaybackSpeedIndex,
    formatPlaybackTime,
    getPlayerDuration,
    getVideoEl,
    seekPlayer,
    togglePlayerFullscreen,
    togglePlayerMute,
    togglePlayerPlay,
} from './playerControlsApi';
import { readSpeedIndexPreference } from './speedPreference';
import { subscribePlayerControlState } from './subscribePlayerControlState';

type FeedFullscreenControls = {
    isFullscreenUi: boolean;
    toggleFullscreen: () => Promise<boolean>;
};

type UseDouyinPlayerControlStateOptions = {
    fixedPlaybackSpeed?: boolean;
    fullscreen?: FeedFullscreenControls;
};

export function useDouyinPlayerControlState(
    player: Player | null,
    options: UseDouyinPlayerControlStateOptions = {},
) {
    const { fixedPlaybackSpeed = false, fullscreen } = options;
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [speedIndex, setSpeedIndex] = useState(() =>
        fixedPlaybackSpeed
            ? FIXED_PLAYBACK_SPEED_INDEX
            : readSpeedIndexPreference(PLAYBACK_SPEEDS.length - 1),
    );
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [progressDragging, setProgressDragging] = useState(false);
    const [progressHover, setProgressHover] = useState(false);

    const progressDraggingRef = useRef(progressDragging);
    progressDraggingRef.current = progressDragging;

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
            fixedPlaybackSpeed,
        });

        setSpeedIndex(
            fixedPlaybackSpeed ? FIXED_PLAYBACK_SPEED_INDEX : subscription.speedIndex,
        );
        setMuted(subscription.muted);

        return subscription.dispose;
    }, [player, fixedPlaybackSpeed]);

    /** 固定 1.0x：`load()` 后补回倍速（对标 ForYouPlayer） */
    useEffect(() => {
        if (!fixedPlaybackSpeed || !player) {
            return;
        }
        const video = getVideoEl(player);
        if (!video) {
            return;
        }
        const reapply = () => {
            applyPlaybackSpeed(player, FIXED_PLAYBACK_SPEED_INDEX, false);
        };
        reapply();
        video.addEventListener('loadedmetadata', reapply);
        video.addEventListener('canplay', reapply);
        return () => {
            video.removeEventListener('loadedmetadata', reapply);
            video.removeEventListener('canplay', reapply);
        };
    }, [player, fixedPlaybackSpeed]);

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
        if (fullscreen) {
            await fullscreen.toggleFullscreen();
            return;
        }
        const fs = await togglePlayerFullscreen(player);
        setIsFullscreen(fs);
    }, [fullscreen, player]);

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
        isFullscreen: fullscreen?.isFullscreenUi ?? isFullscreen,
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
