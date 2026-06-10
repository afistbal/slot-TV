/**
 * v-demo：先拉 `movie/info` 拿到剧详情与选集列表（无 mp4/vtt）。
 */
import { api } from '@/api';
import type { IPlayerData } from '@/types/videoPlayer';

import { ensureForDemoBootstrap } from '../ForDemo/forDemoBootstrap';

export async function fetchVDemoMovieInfo(
    movieId: number,
): Promise<
    | { ok: true; data: IPlayerData }
    | { ok: false; message: string }
> {
    try {
        await ensureForDemoBootstrap();
    } catch (e) {
        const message = e instanceof Error ? e.message : 'bootstrap failed';
        return { ok: false, message };
    }

    const result = await api<IPlayerData>('movie/info', {
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
