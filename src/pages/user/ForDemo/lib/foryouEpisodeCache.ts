import type { IPlayerEpisode } from '@/types/videoPlayer';

/** For You 专用集详情缓存（仅来自 `/api/foryou` feed，不与 /video 的 episodeDetailCache 共用） */
const detailById = new Map<number, IPlayerEpisode>();

export function getForyouEpisodeFromCache(id: number): IPlayerEpisode | undefined {
    return detailById.get(Number(id));
}

export function putForyouEpisodeCache(id: number, ep: IPlayerEpisode): void {
    detailById.set(Number(id), ep);
}

export function clearForyouEpisodeCache(): void {
    detailById.clear();
}
