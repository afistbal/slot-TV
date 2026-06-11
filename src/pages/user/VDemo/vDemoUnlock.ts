import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { isEpisodeDetailLocked } from '@/components/video-player/videoPlayerUtils';

import { putVDemoActiveEpisodeDetail, getVDemoActiveEpisodeDetail } from './fetchVDemoEpisode';
import { getVDemoEpisodeDetail, patchVDemoEpisodeDetailUnlock } from './fetchVDemoEpisodesBatch';

/** lock 展示：movie/episode > batch > info.locked（与 buildVDemoFeedItems 一致，不用「无 url」推断） */
export function resolveVDemoRowLocked(
    row: IPlayerData['episodes'][number] | undefined,
    /** 为 true 时无 API/batch 详情则视为未锁定（避免列表 row.locked 兜底误弹套餐） */
    confirmedOnly = false,
): boolean {
    if (!row) {
        return false;
    }
    const activeDetail = getVDemoActiveEpisodeDetail(row.id);
    if (activeDetail) {
        return activeDetail.lock === true;
    }
    const batchDetail = getVDemoEpisodeDetail(row.id);
    if (batchDetail != null) {
        return isEpisodeDetailLocked(batchDetail.lock);
    }
    if (confirmedOnly) {
        return false;
    }
    return row.locked === 1;
}

export function isVDemoEpisodeLocked(
    row: IPlayerData['episodes'][number] | undefined,
    confirmedOnly = false,
): boolean {
    return resolveVDemoRowLocked(row, confirmedOnly);
}

/** 分集抽屉锁角标：movie/episode / batch 解锁后去掉锁；fallback 对齐 info vip+locked */
export function resolveVDemoDrawerEpisodeLocked(
    row: IPlayerData['episodes'][number],
    viewerIsVip: boolean,
): boolean {
    if (viewerIsVip) {
        return false;
    }
    const activeDetail = getVDemoActiveEpisodeDetail(row.id);
    if (activeDetail) {
        return activeDetail.lock === true;
    }
    const batchDetail = getVDemoEpisodeDetail(row.id);
    if (batchDetail != null) {
        return isEpisodeDetailLocked(batchDetail.lock);
    }
    return row.vip !== 0 && row.locked === 1;
}

export function applyVDemoEpisodeUnlock(ep: IPlayerEpisode): void {
    putVDemoActiveEpisodeDetail(ep);
    syncVDemoEpisodeVideoToBatch(ep);
}

/** movie/episode 扣款/解锁后若有 mp4，写入 batch 缓存供 feed 播放 */
export function syncVDemoEpisodeVideoToBatch(ep: IPlayerEpisode): void {
    const id = Number(ep.id);
    if (!Number.isFinite(id) || id <= 0) {
        return;
    }
    const video = String(ep.video ?? '').trim();
    if (!video) {
        return;
    }
    patchVDemoEpisodeDetailUnlock(id, {
        video,
        subtitle: String(ep.subtitle ?? '').trim(),
        lock: isEpisodeDetailLocked(ep.lock),
        unlock_coins: Number(ep.unlock_coins ?? 0),
    });
}
