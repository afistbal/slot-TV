import { api } from '@/api';
import { skipRemoteApi } from '@/env';

const reportedMovieIds = new Set<number>();

/** 剧最后一集播完上报 `POST movie/watched` */
export function reportMovieWatched(movieId: number): void {
    if (skipRemoteApi || !movieId || reportedMovieIds.has(movieId)) {
        return;
    }
    reportedMovieIds.add(movieId);
    void api('movie/watched', {
        method: 'post',
        data: { movie_id: movieId },
        loading: false,
        toastOnError: false,
    });
}
