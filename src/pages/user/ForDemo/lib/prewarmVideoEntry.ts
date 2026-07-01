import type { IForYouFeedItem } from '@/types/foryouFeed';

const routePrewarm = {
    done: false,
    promise: null as Promise<unknown> | null,
};

const entryPrewarm = new Set<string>();

export function prewarmVDemoRouteChunk(): void {
    if (routePrewarm.done) {
        return;
    }
    if (!routePrewarm.promise) {
        routePrewarm.promise = import('@/pages/user/VDemo')
            .then(() => {
                routePrewarm.done = true;
            })
            .catch(() => {
                routePrewarm.promise = null;
            });
    }
}

export function prewarmForyouVideoEntry(item: IForYouFeedItem | null | undefined): void {
    if (!item?.id) {
        return;
    }

    prewarmVDemoRouteChunk();

    const movieId = Number(item.id);
    const episodeNo = Number(item.episode ?? 1);
    const key = `${movieId}:${episodeNo}:${Number(item.ep_id ?? 0)}`;
    if (entryPrewarm.has(key)) {
        return;
    }
    entryPrewarm.add(key);

    void (async () => {
        const [{ fetchVDemoMovieInfo }, { fetchVDemoEpisodesBatch }] = await Promise.all([
            import('@/pages/user/VDemo/fetchVDemoMovieInfo'),
            import('@/pages/user/VDemo/fetchVDemoEpisodesBatch'),
        ]);
        const res = await fetchVDemoMovieInfo(movieId);
        if (!res.ok) {
            return;
        }

        const episodes = res.data.episodes ?? [];
        const startIndex = Math.max(
            0,
            episodes.findIndex((row) =>
                Number(row.id) === Number(item.ep_id) ||
                Number(row.episode) === episodeNo,
            ),
        );
        const ids = episodes
            .slice(startIndex, Math.min(episodes.length, startIndex + 3))
            .map((row) => Number(row.id))
            .filter((id) => id > 0);
        if (ids.length) {
            await fetchVDemoEpisodesBatch(movieId, ids);
        }
    })().catch(() => {
        entryPrewarm.delete(key);
    });
}

export function scheduleForyouVideoEntryPrewarm(
    item: IForYouFeedItem | null | undefined,
): () => void {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    prewarmVDemoRouteChunk();

    let cancelled = false;
    const run = () => {
        if (!cancelled) {
            prewarmForyouVideoEntry(item);
        }
    };

    let idleId: number | null = null;
    let timerId: number | null = null;

    if (typeof globalThis.requestIdleCallback === 'function') {
        idleId = globalThis.requestIdleCallback(run, { timeout: 2500 });
    }
    timerId = window.setTimeout(run, 180);

    return () => {
        cancelled = true;
        if (idleId != null && typeof globalThis.cancelIdleCallback === 'function') {
            globalThis.cancelIdleCallback(idleId);
        }
        if (timerId != null) {
            window.clearTimeout(timerId);
        }
    };
}
