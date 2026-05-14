import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlinePlayerEpisode } from '@/mocks/videoOffline';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';

const detailById = new Map<number, IPlayerEpisode>();
const inflight = new Map<number, Promise<IPlayerEpisode | null>>();

/** 与 `movie/info` 的 `episodes` 一并传入，用于非会员跳过 VIP 专享集的 `movie/episode` 请求 */
export type EpisodeFetchOpts = {
    viewerIsVip: boolean;
    episodes: IPlayerData['episodes'];
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

/**
 * 非会员 + 列表中该集 `vip !== 0`：`movie/info` 已标明为 VIP 区，无需再打 `movie/episode`。
 * 不写入缓存，避免用户开通会员后仍命中旧占位。
 */
export function buildNonVipStubForVipOnlyEpisode(row: IPlayerData['episodes'][number]): IPlayerEpisode {
    return {
        id: Number(row.id),
        episode: row.episode,
        video: '',
        subtitle: '',
        lock: true,
        unlock_coins: 0,
        can_unlock: false,
    };
}

function tryNonVipVipOnlyEpisodeStub(id: number, opts?: EpisodeFetchOpts): IPlayerEpisode | null {
    if (!opts || opts.viewerIsVip) {
        return null;
    }
    const row = opts.episodes.find((e) => Number(e.id) === Number(id));
    if (!row || row.vip === 0) {
        return null;
    }
    return buildNonVipStubForVipOnlyEpisode(row);
}

/**
 * 唯一入口：缓存命中、与进行中的请求合并，避免预拉与 VideoPlayer 等对同一 id 重复打 `movie/episode`。
 */
export async function fetchEpisodeDetailOrNull(
    id: number,
    showApiLoading = false,
    opts?: EpisodeFetchOpts,
): Promise<IPlayerEpisode | null> {
    const stub = tryNonVipVipOnlyEpisodeStub(id, opts);
    if (stub) {
        return stub;
    }

    const nid = Number(id);
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
                    auto_unlock: localStorage.getItem('auto_unlock') ?? 1,
                },
                loading: showApiLoading,
            });
            if (result.c !== 0) {
                return null;
            }
            const ep = result.d;
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
    if (tryNonVipVipOnlyEpisodeStub(id, opts)) {
        return;
    }
    await fetchEpisodeDetailOrNull(id, false, opts);
}
