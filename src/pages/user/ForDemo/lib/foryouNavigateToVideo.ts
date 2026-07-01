import type { NavigateFunction } from 'react-router';
import { getPlayerCurrentTime } from '@/components/douyin-feed-player/controls/playerControlsApi';
import * as playerRegistry from '@/components/douyin-feed-player/player/playerRegistry';
import {
    forYouResumeStorageKey,
    type ForYouToVideoLocationState,
} from '@/constants/foryouRoute';
import { useForyouFeedStore } from '@/stores/foryouFeed';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import { markVideoSessionUserUnmuted } from '@/components/video-player/videoSessionMute';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import { prewarmForyouVideoEntry } from './prewarmVideoEntry';

export function navigateFromForyouToVideo(
    navigate: NavigateFunction,
    item: IForYouFeedItem,
    resumeTimeSec: number,
    activeIndex?: number,
): void {
    prewarmForyouVideoEntry(item);
    const episodeNo = item.episode ?? 1;

    if (activeIndex != null && activeIndex >= 0 && useForyouFeedStore.getState().list.length) {
        useForyouFeedStore.getState().setActiveIndex(activeIndex);
    }

    if (resumeTimeSec > 0) {
        sessionStorage.setItem(
            forYouResumeStorageKey(item.id, item.ep_id),
            String(resumeTimeSec),
        );
    }

    const state: ForYouToVideoLocationState = {
        ...VIDEO_FROM_HOME_STATE,
        fromForYouPlayback: true,
        resumeTime: resumeTimeSec > 0 ? resumeTimeSec : undefined,
        episodeRowId: item.ep_id,
    };

    navigate(`/video/${item.id}/${episodeNo}`, { state });
}

/** for-demo /foryou：取当前 Feed 播放进度后进 /video 续播 */
export function navigateFromForDemoWatchFull(
    navigate: NavigateFunction,
    item: IForYouFeedItem,
    activeIndex: number,
): void {
    const activeId = playerRegistry.getActiveId();
    const player = activeId != null ? playerRegistry.get(activeId) : undefined;
    const resume = getPlayerCurrentTime(player ?? null);
    const video = player?.video as HTMLVideoElement | undefined;
    if (video && !video.muted) {
        markVideoSessionUserUnmuted();
    }
    navigateFromForyouToVideo(navigate, item, resume, activeIndex);
}
