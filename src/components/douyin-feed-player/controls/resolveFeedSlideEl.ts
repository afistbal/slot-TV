import type Player from 'xgplayer';

import { getVideoEl } from './playerControlsApi';

/** 全屏容器：当前 slide，避免 ref 回调里 setState 导致无限重渲染 */
export function resolveFeedSlideEl(from: HTMLElement | Player | null): HTMLElement | null {
    if (!from) return null;
    if ('video' in from) {
        const video = getVideoEl(from as Player);
        return (video?.closest('.douyin-feed-player__slide') as HTMLElement | null) ?? null;
    }
    return (from as HTMLElement).closest('.douyin-feed-player__slide') as HTMLElement | null;
}
