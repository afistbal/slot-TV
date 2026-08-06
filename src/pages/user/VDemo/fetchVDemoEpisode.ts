/** Fetch the active episode on every slide to refresh lock/can_unlock state. */
import { api } from '@/api';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { isEpisodeDetailLocked } from '@/components/video-player/videoPlayerUtils';
import { isTikTokPlatform } from '@/platform';
import { isTikTokIapMode } from '@/lib/tiktokMonetization';

const activeEpisodeCache = new Map<number, IPlayerEpisode>();
const inflightById = new Map<number, Promise<IPlayerEpisode | null>>();

export function getVDemoActiveEpisodeDetail(episodeRowId: number): IPlayerEpisode | undefined {
    return activeEpisodeCache.get(Number(episodeRowId));
}

export function putVDemoActiveEpisodeDetail(ep: IPlayerEpisode): void {
    const id = Number(ep.id);
    if (!Number.isFinite(id) || id <= 0) {
        return;
    }
    activeEpisodeCache.set(id, {
        ...ep,
        lock: isEpisodeDetailLocked(ep.lock),
    });
}

export function clearVDemoActiveEpisodeCache(): void {
    activeEpisodeCache.clear();
    inflightById.clear();
}

/** 每次 active 都请求；仅合并进行中的同 id 请求 */
export async function fetchVDemoActiveEpisode(
    episodeRowId: number,
    viewerIsVip: boolean,
): Promise<IPlayerEpisode | null> {
    const nid = Number(episodeRowId);
    if (!Number.isFinite(nid) || nid <= 0) {
        return null;
    }

    const existing = inflightById.get(nid);
    if (existing) {
        return existing;
    }

    // TikTok IAA must never fall through to the legacy coin auto-unlock path.
    // Keep the old behavior available behind the IAP mode for a later launch.
    const autoUnlock = isTikTokPlatform() && !isTikTokIapMode()
        ? 0
        : viewerIsVip
          ? 0
          : 1;
    const task = (async (): Promise<IPlayerEpisode | null> => {
        try {
            const result = await api<IPlayerEpisode>('movie/episode', {
                data: {
                    id: nid,
                    auto_unlock: autoUnlock,
                },
                loading: false,
            });

            if (result.c !== 0) {
                return null;
            }

            const ep: IPlayerEpisode = {
                ...result.d,
                lock: isEpisodeDetailLocked(result.d.lock),
            };
            activeEpisodeCache.set(Number(ep.id) || nid, ep);
            return ep;
        } finally {
            inflightById.delete(nid);
        }
    })();

    inflightById.set(nid, task);
    return task;
}
