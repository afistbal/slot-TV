import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import {
    fetchEpisodeDetailOrNull,
    getEpisodeDetailFromCache,
    putEpisodeDetailCache,
    type EpisodeFetchOpts,
} from './episodeDetailCache';
import { isEpisodeDetailLocked } from './videoPlayerUtils';
import {
    VIDEO_PLAYER_WINDOW_NEXT,
    VIDEO_PLAYER_WINDOW_PREV,
} from './videoSeriesConstants';

/** 本剧已拉取过详情（含 mp4/vtt 或锁页）的 ep row id，只增不减；换剧时 clear */
const fullQueueRowIdsByMovie = new Map<number, Set<number>>();

export function clearVideoEpisodeQueues(movieId: number): void {
    fullQueueRowIdsByMovie.delete(Number(movieId));
}

export function clearAllVideoEpisodeQueues(): void {
    fullQueueRowIdsByMovie.clear();
}

export function getFullQueueRowIds(movieId: number): ReadonlySet<number> {
    return fullQueueRowIdsByMovie.get(Number(movieId)) ?? new Set<number>();
}

export function isInFullQueue(movieId: number, episodeRowId: number): boolean {
    return getFullQueueRowIds(movieId).has(Number(episodeRowId));
}

export function unregisterEpisodeFromFullQueue(movieId: number, episodeRowId: number): void {
    fullQueueRowIdsByMovie.get(Number(movieId))?.delete(Number(episodeRowId));
}

export function registerEpisodeInFullQueue(movieId: number, detail: IPlayerEpisode): void {
    const mid = Number(movieId);
    const rowId = Number(detail.id);
    let set = fullQueueRowIdsByMovie.get(mid);
    if (!set) {
        set = new Set<number>();
        fullQueueRowIdsByMovie.set(mid, set);
    }
    set.add(rowId);
    putEpisodeDetailCache(rowId, detail);
}

function isEpisodeDetailReady(ep: IPlayerEpisode): boolean {
    if (isEpisodeDetailLocked(ep.lock)) {
        return true;
    }
    return Boolean(ep.video?.trim() || (ep.video_urls?.length ?? 0) > 0);
}

export function isEpisodeCachedReady(episodeRowId: number): boolean {
    const cached = getEpisodeDetailFromCache(episodeRowId);
    return cached != null && isEpisodeDetailReady(cached);
}

/** 预加载窗口：当前集 ±1 的 list 下标 */
export function getPreloadWindowIndices(activeIndex: number, total: number): number[] {
    const indices: number[] = [];
    for (
        let i = activeIndex - VIDEO_PLAYER_WINDOW_PREV;
        i <= activeIndex + VIDEO_PLAYER_WINDOW_NEXT;
        i += 1
    ) {
        if (i >= 0 && i < total) {
            indices.push(i);
        }
    }
    return indices;
}

/** 预加载窗口内需要请求的 ep row id（含当前集） */
export function getPreloadWindowRowIds(
    episodes: IPlayerData['episodes'],
    activeIndex: number,
    viewerIsVip: boolean,
): number[] {
    if (!episodes.length) {
        return [];
    }
    const ids: number[] = [];
    for (const idx of getPreloadWindowIndices(activeIndex, episodes.length)) {
        const row = episodes[idx];
        if (!row) {
            continue;
        }
        if (!viewerIsVip && row.vip !== 0) {
            continue;
        }
        ids.push(row.id);
    }
    return [...new Set(ids)];
}

export function getMissingPreloadRowIds(windowRowIds: number[]): number[] {
    return windowRowIds.filter((id) => !isEpisodeCachedReady(id));
}

/**
 * 拉取单集并写入全量队列 + episodeDetailCache。
 * 已有 mp4/vtt（或锁页）则不再打 `movie/episode`。
 */
export async function fetchEpisodeIntoQueues(
    movieId: number,
    episodeRowId: number,
    opts: EpisodeFetchOpts,
    showLoading = false,
): Promise<IPlayerEpisode | null> {
    const nid = Number(episodeRowId);
    const cached = getEpisodeDetailFromCache(nid);
    if (cached && isEpisodeDetailReady(cached)) {
        registerEpisodeInFullQueue(movieId, cached);
        return cached;
    }
    const detail = await fetchEpisodeDetailOrNull(nid, showLoading, opts);
    if (detail) {
        registerEpisodeInFullQueue(movieId, detail);
    }
    return detail;
}

/**
 * 同步预加载窗口：仅请求窗口内尚未 cached 的集（滑到第 3 集只补第 4 集，1–3 不重拉）。
 * @param neighborsOnly 为 true 时跳过当前 active 集（由 VideoPlayer.loadData 负责）
 * @param sequential 为 true 时逐条预拉，避免 H5 并发回写引发首屏闪
 */
export async function syncVideoPreloadWindow(
    movieId: number,
    episodes: IPlayerData['episodes'],
    activeIndex: number,
    opts: EpisodeFetchOpts,
    preloadOpts?: { neighborsOnly?: boolean; sequential?: boolean },
): Promise<void> {
    let windowRowIds = getPreloadWindowRowIds(episodes, activeIndex, opts.viewerIsVip);
    if (preloadOpts?.neighborsOnly) {
        const activeRowId = episodes[activeIndex]?.id;
        if (activeRowId != null) {
            windowRowIds = windowRowIds.filter((id) => id !== activeRowId);
        }
    }
    for (const rowId of windowRowIds) {
        const cached = getEpisodeDetailFromCache(rowId);
        if (cached && isEpisodeDetailReady(cached)) {
            registerEpisodeInFullQueue(movieId, cached);
        }
    }
    const missing = getMissingPreloadRowIds(windowRowIds);
    if (!missing.length) {
        return;
    }
    if (preloadOpts?.sequential) {
        for (const rowId of missing) {
            await fetchEpisodeIntoQueues(movieId, rowId, opts, false);
        }
        return;
    }
    await Promise.all(
        missing.map((rowId) => fetchEpisodeIntoQueues(movieId, rowId, opts, false)),
    );
}

export function createQueueEpisodeFetcher(
    movieId: number,
    opts: EpisodeFetchOpts,
): (episodeRowId: number, showLoading?: boolean) => Promise<IPlayerEpisode | null> {
    return (episodeRowId, showLoading = false) =>
        fetchEpisodeIntoQueues(movieId, episodeRowId, opts, showLoading);
}
