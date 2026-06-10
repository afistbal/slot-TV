/**

 * v-demo 编排：batch 驱动播放；movie/episode 仅权限/扣费，不阻塞播放。

 */

import type { DouyinFeedVideoItem } from '@/components/douyin-feed-player';

import type { IPlayerData } from '@/types/videoPlayer';

import { isEpisodeDetailLocked } from '@/pages/user/VideoPage/videoPlayerUtils';



import { fetchVDemoActiveEpisode } from './fetchVDemoEpisode';

import { fetchVDemoEpisodesBatch, getVDemoEpisodeDetail } from './fetchVDemoEpisodesBatch';

import { getVDemoPreloadWindowRowIds } from './vDemoPreloadWindow';



/** active 集：movie/episode（lock / auto_unlock），后台执行，不影响 url */

export function syncVDemoPermission(

    episodes: IPlayerData['episodes'],

    activeIndex: number,

    viewerIsVip: boolean,

): void {

    const row = episodes[activeIndex];

    if (!row) {

        return;

    }

    void fetchVDemoActiveEpisode(row.id, viewerIsVip);

}



/** 预加载窗口：movie/episodes/batch，决定 mp4/vtt 与可播态 */

export async function syncVDemoBatchPreload(

    movieId: number,

    episodes: IPlayerData['episodes'],

    activeIndex: number,

    viewerIsVip: boolean,

): Promise<void> {

    const rowIds = getVDemoPreloadWindowRowIds(episodes, activeIndex, viewerIsVip);

    if (!rowIds.length) {

        return;

    }

    await fetchVDemoEpisodesBatch(movieId, rowIds);

}



/** 滑集：先 batch（await），episode 后台 fire-and-forget */

export async function syncVDemoOnActiveIndex(

    movieId: number,

    episodes: IPlayerData['episodes'],

    activeIndex: number,

    viewerIsVip: boolean,

): Promise<void> {

    await syncVDemoBatchPreload(movieId, episodes, activeIndex, viewerIsVip);

    syncVDemoPermission(episodes, activeIndex, viewerIsVip);

}



export function buildVDemoFeedItems(

    episodes: IPlayerData['episodes'],

): DouyinFeedVideoItem[] {

    return episodes.map((row) => {

        const batchDetail = getVDemoEpisodeDetail(row.id);



        const locked = batchDetail != null

            ? isEpisodeDetailLocked(batchDetail.lock)

            : row.locked === 1;



        const video = batchDetail?.video ?? '';

        const subtitle = batchDetail?.subtitle ?? '';



        return {

            id: row.id,

            url: locked ? '' : String(video).trim(),

            subtitle,

        };

    });

}


