import { api } from '@/api';

import { skipRemoteApi } from '@/env';

import { offlinePlayerEpisode } from '@/mocks/videoOffline';

import type { IPlayerEpisode } from '@/types/videoPlayer';
import { isEpisodeDetailLocked } from './videoPlayerUtils';



const detailById = new Map<number, IPlayerEpisode>();

const inflight = new Map<number, Promise<IPlayerEpisode | null>>();



/** 传入 `viewerIsVip` 用于 `movie/episode` 的 `auto_unlock`（VIP=0，非 VIP=1） */

export type EpisodeFetchOpts = {

    viewerIsVip: boolean;

};



export function getEpisodeDetailFromCache(id: number): IPlayerEpisode | undefined {

    return detailById.get(Number(id));

}



export function putEpisodeDetailCache(id: number, ep: IPlayerEpisode): void {

    detailById.set(Number(id), ep);

}



export function clearEpisodeDetailCache(): void {

    detailById.clear();

    inflight.clear();

}



/** 支付/VIP 变更后：去掉该集缓存，下次 `fetchEpisodeDetailOrNull` 会再打 `movie/episode` */

export function invalidateEpisodeDetailCache(id: number): void {

    detailById.delete(Number(id));

}



/**

 * 唯一入口：缓存命中、与进行中的请求合并，避免预拉与 VideoPlayer 等对同一 id 重复打 `movie/episode`。

 */

export async function fetchEpisodeDetailOrNull(

    id: number,

    showApiLoading = false,

    opts?: EpisodeFetchOpts,

): Promise<IPlayerEpisode | null> {

    const nid = Number(id);

    const autoUnlock = opts?.viewerIsVip ? 0 : 1;

    /** auto_unlock 后 lock 可能变 false，勿用旧的「仍上锁」缓存 */

    if (autoUnlock === 1) {

        detailById.delete(nid);

    }



    const cached = detailById.get(nid);

    if (cached) {

        return cached;

    }



    const existing = inflight.get(nid);

    if (existing) {

        return existing;

    }



    const task = (async (): Promise<IPlayerEpisode | null> => {

        try {

            if (skipRemoteApi) {

                const ep = offlinePlayerEpisode(nid);

                detailById.set(nid, ep);

                return ep;

            }

            const result = await api<IPlayerEpisode>('movie/episode', {

                data: {

                    id: nid,

                    auto_unlock: autoUnlock,

                },

                loading: showApiLoading,

            });

            if (result.c !== 0) {

                return null;

            }

            const ep: IPlayerEpisode = {
                ...result.d,
                lock: isEpisodeDetailLocked(result.d.lock),
            };

            detailById.set(Number(ep.id) || nid, ep);

            return ep;

        } finally {

            inflight.delete(nid);

        }

    })();



    inflight.set(nid, task);

    return task;

}



export async function prewarmEpisodeDetail(id: number, opts?: EpisodeFetchOpts): Promise<void> {

    await fetchEpisodeDetailOrNull(id, false, opts);

}


