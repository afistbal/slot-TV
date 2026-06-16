import { api } from '@/api';
import { skipRemoteApi } from '@/env';

export type MovieEpProgressPayload = {
    movie_id: number;
    ep_id: number;
    ep_no: number;
    duration: number;
    completed: boolean;
};

export function reportMovieEpProgress(payload: MovieEpProgressPayload): void {
    if (skipRemoteApi) {
        return;
    }
    void api('movie/history/report', {
        loading: false,
        toastOnError: false,
        data: {
            type: 'ep_prog',
            ...payload,
        },
    });
}
