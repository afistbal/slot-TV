import type { NavigateFunction } from 'react-router';
import {
    forYouResumeStorageKey,
    type ForYouToVideoLocationState,
} from '@/constants/foryouRoute';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import type { IForYouFeedItem } from '@/types/foryouFeed';

export function navigateFromForyouToVideo(
    navigate: NavigateFunction,
    item: IForYouFeedItem,
    resumeTimeSec: number,
): void {
    const episodeNo = item.episode ?? 1;

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
