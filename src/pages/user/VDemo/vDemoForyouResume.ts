import { useCallback, useRef, type MutableRefObject } from 'react';
import type { PlaybackMode } from '@/components/douyin-feed-player';
import * as playerRegistry from '@/components/douyin-feed-player/player/playerRegistry';
import { applyVideoResumeTime } from '@/pages/user/VideoPage/applyVideoResumeTime';

export function useVDemoForyouResumeHandler(
    resumeTimeSec: number | undefined,
    resumeEpisodeRowId: number | undefined,
    activeEpisodeRowId: number | undefined,
    activeItemId: string | number | undefined,
): (index: number, mode: PlaybackMode) => void {
    const appliedRef = useRef(false);
    return useCallback(
        (_index: number, _mode: PlaybackMode) => {
            scheduleVDemoForyouResume(
                resumeTimeSec,
                resumeEpisodeRowId,
                activeEpisodeRowId,
                activeItemId,
                appliedRef,
            );
        },
        [resumeTimeSec, resumeEpisodeRowId, activeEpisodeRowId, activeItemId],
    );
}

function tryApplyVDemoForyouResume(
    resumeTimeSec: number | undefined,
    resumeEpisodeRowId: number | undefined,
    activeEpisodeRowId: number | undefined,
    activeItemId: string | number | undefined,
    appliedRef: MutableRefObject<boolean>,
): void {
    if (appliedRef.current || !resumeTimeSec || resumeTimeSec <= 0) {
        return;
    }
    if (resumeEpisodeRowId != null && activeEpisodeRowId !== resumeEpisodeRowId) {
        return;
    }
    if (activeItemId == null) {
        return;
    }
    const player = playerRegistry.get(activeItemId);
    const video = player?.video as HTMLVideoElement | undefined;
    if (!video) {
        return;
    }
    applyVideoResumeTime(video, resumeTimeSec);
    appliedRef.current = true;
}

function scheduleVDemoForyouResume(
    resumeTimeSec: number | undefined,
    resumeEpisodeRowId: number | undefined,
    activeEpisodeRowId: number | undefined,
    activeItemId: string | number | undefined,
    appliedRef: MutableRefObject<boolean>,
): void {
    tryApplyVDemoForyouResume(
        resumeTimeSec,
        resumeEpisodeRowId,
        activeEpisodeRowId,
        activeItemId,
        appliedRef,
    );
    if (appliedRef.current) {
        return;
    }
    requestAnimationFrame(() => {
        tryApplyVDemoForyouResume(
            resumeTimeSec,
            resumeEpisodeRowId,
            activeEpisodeRowId,
            activeItemId,
            appliedRef,
        );
    });
}
