import { api, formatApiFailure } from '@/api';
import { skipRemoteApi } from '@/env';

export type MovieEpProgressPayload = {
    movie_id: number;
    ep_id: number;
    ep_no: number;
    duration: number;
    completed: boolean;
};

export function reportMovieEpProgress(payload: MovieEpProgressPayload): void {
    void saveMovieEpProgress(payload).catch(() => undefined);
}

export async function saveMovieEpProgress(payload: MovieEpProgressPayload): Promise<void> {
    if (skipRemoteApi) {
        return;
    }
    const result = await api('movie/history/report', {
        method: 'post',
        loading: false,
        toastOnError: false,
        data: {
            type: 'ep_prog',
            ...payload,
        },
    });
    if (result.c !== 0) throw new Error(formatApiFailure('POST', 'movie/history/report', result));
}
