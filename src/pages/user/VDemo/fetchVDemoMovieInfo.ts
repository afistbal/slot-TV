/**
 * v-demo：先拉 `movie/info` 拿到剧详情与选集列表（无 mp4/vtt）。
 */
import { api } from '@/api';
import type { IPlayerData } from '@/types/videoPlayer';

export type VDemoPlayerData = IPlayerData & {
    info: IPlayerData['info'] & {
        /** URL 无 `:episode` 时的起播集序号 */
        play?: number;
    };
    episodes: Array<{
        id: number;
        episode: number;
        vip: number;
        locked: number;
        image?: string;
    }>;
};

export async function fetchVDemoMovieInfo(
    movieId: number,
): Promise<
    | { ok: true; data: VDemoPlayerData }
    | { ok: false; message: string }
> {
    const result = await api<VDemoPlayerData>('movie/info', {
        data: { id: movieId },
        loading: false,
    });

    if (result.c !== 0) {
        return { ok: false, message: result.m || 'movie/info failed' };
    }

    const episodes = [...(result.d.episodes ?? [])].sort(
        (a, b) => Number(a.episode) - Number(b.episode),
    );

    return {
        ok: true,
        data: {
            ...result.d,
            episodes,
        },
    };
}
