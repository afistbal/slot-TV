import { useEffect, useState } from 'react';

import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';

import { fetchVDemoActiveEpisode, getVDemoActiveEpisodeDetail } from './fetchVDemoEpisode';
import { resolveVDemoRowLocked, syncVDemoEpisodeVideoToBatch } from './vDemoUnlock';

/** 抽屉/简介用集元数据：优先 movie/episode 缓存，否则 info 列表行 */
export function resolveVDemoShellEpisode(
    row: IPlayerData['episodes'][number] | undefined,
): IPlayerEpisode | undefined {
    if (!row) {
        return undefined;
    }
    const cached = getVDemoActiveEpisodeDetail(row.id);
    if (cached) {
        return cached;
    }
    return {
        id: row.id,
        episode: row.episode,
        video: '',
        subtitle: '',
        lock: resolveVDemoRowLocked(row),
        unlock_coins: 0,
        can_unlock: false,
    };
}

/** active 集 movie/episode 拉取后触发重渲染（lock / unlock_coins） */
export function useVDemoActiveEpisode(
    row: IPlayerData['episodes'][number] | undefined,
    viewerIsVip: boolean,
    onEpisodeDetailReady?: () => void,
): IPlayerEpisode | undefined {
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        if (!row) {
            return;
        }
        let cancelled = false;
        void fetchVDemoActiveEpisode(row.id, viewerIsVip).then((ep) => {
            if (!cancelled && ep) {
                syncVDemoEpisodeVideoToBatch(ep);
                setRevision((n) => n + 1);
                onEpisodeDetailReady?.();
            }
        });
        return () => {
            cancelled = true;
        };
    }, [row?.id, viewerIsVip, onEpisodeDetailReady]);

    void revision;
    return resolveVDemoShellEpisode(row);
}
