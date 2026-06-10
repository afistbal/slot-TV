/**
 * v-demo：`POST movie/episodes/batch` 批量拉 mp4/vtt。
 */
import { api } from '@/api';

export type VDemoEpisodeDetail = {
    id: number;
    episode: number;
    video: string;
    subtitle: string;
    image: string;
    vip: number;
    lock: boolean;
    unlock_coins: number;
};

type BatchMaps = Record<
    string,
    {
        episode?: number;
        video?: string;
        subtitle?: string;
        image?: string;
        vip?: number;
        lock?: boolean;
        unlock_coins?: number;
    }
>;

const detailCache = new Map<number, VDemoEpisodeDetail>();
const inflightByKey = new Map<string, Promise<void>>();

function batchRequestKey(movieId: number, ids: number[]): string {
    return `${movieId}:${[...ids].sort((a, b) => a - b).join(',')}`;
}

function normalizeBatchDetail(
    episodeRowId: number,
    raw: NonNullable<BatchMaps[string]>,
): VDemoEpisodeDetail {
    return {
        id: episodeRowId,
        episode: Number(raw.episode ?? 0),
        video: String(raw.video ?? '').trim(),
        subtitle: String(raw.subtitle ?? '').trim(),
        image: String(raw.image ?? '').trim(),
        vip: Number(raw.vip ?? 0),
        lock: Boolean(raw.lock),
        unlock_coins: Number(raw.unlock_coins ?? 0),
    };
}

export function getVDemoEpisodeDetail(episodeRowId: number): VDemoEpisodeDetail | undefined {
    return detailCache.get(Number(episodeRowId));
}

export function getVDemoEpisodeVideoUrl(episodeRowId: number): string {
    const detail = getVDemoEpisodeDetail(episodeRowId);
    if (!detail || detail.lock || !detail.video) {
        return '';
    }
    return detail.video;
}

export function clearVDemoEpisodeCache(): void {
    detailCache.clear();
    inflightByKey.clear();
}

export async function fetchVDemoEpisodesBatch(
    movieId: number,
    episodeRowIds: number[],
): Promise<void> {
    const uniqueIds = [...new Set(episodeRowIds.map((id) => Number(id)).filter((id) => id > 0))];
    const missingIds = uniqueIds.filter((id) => !detailCache.has(id));
    if (!missingIds.length) {
        return;
    }

    const requestKey = batchRequestKey(movieId, missingIds);
    const existing = inflightByKey.get(requestKey);
    if (existing) {
        await existing;
        return;
    }

    const task = (async () => {
        const result = await api<{ maps?: BatchMaps }>('movie/episodes/batch', {
            data: {
                movie_id: movieId,
                id: missingIds,
            },
            loading: false,
        });

        if (result.c !== 0) {
            throw new Error(result.m || 'movie/episodes/batch failed');
        }

        const maps = result.d?.maps ?? {};
        for (const rowId of missingIds) {
            const raw = maps[String(rowId)];
            if (!raw) {
                continue;
            }
            detailCache.set(rowId, normalizeBatchDetail(rowId, raw));
        }
    })();

    inflightByKey.set(requestKey, task);
    try {
        await task;
    } finally {
        inflightByKey.delete(requestKey);
    }
}
