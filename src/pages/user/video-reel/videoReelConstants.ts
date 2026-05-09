export const SPEED = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

/** 抖音式竖滑全屏播放入口（与 `/video/` 的 `Video.tsx` 并存） */
export const VIDEO_REEL_PATH = '/video-reel';

export function buildReelEpisodeHref(
    movieId: string | undefined,
    episodeOneBased: number,
    search: string,
) {
    return `${VIDEO_REEL_PATH}/${movieId}/${episodeOneBased}${search}`;
}

export const WHEEL_RESET_MS = 400;
export const WHEEL_WINDOW_SIZE = 20;

export type ShareAction = 'facebook' | 'twitter' | 'link' | 'embed';
