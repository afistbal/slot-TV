/**
 * PC 专用：滚轮仅在剧集竖滑列表上响应（与 douyin 全幅竖滑区一致），阈值与冷却可调且不影响 H5。
 */
import { useEffect, type RefObject } from 'react';
import type { IPlayerData } from '@/types/videoPlayer';

export type UseVideoVerticalSwiperPcWheelParams = {
    listRef: RefObject<HTMLDivElement | null>;
    current: number;
    handleSetEpisode: (index: number) => void;
};

export function useVideoVerticalSwiperPcWheel(
    enabled: boolean,
    data: IPlayerData | undefined,
    initialized: boolean,
    p: UseVideoVerticalSwiperPcWheelParams,
): void {
    const { listRef, current, handleSetEpisode } = p;

    useEffect(() => {
        if (!enabled || !data || !initialized) {
            return;
        }
        const list = listRef.current;
        if (!list) {
            return;
        }
        let accY = 0;
        let cooldownUntil = 0;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        const TH = 140;
        const COOLDOWN_MS = 480;
        const IDLE_RESET_MS = 200;
        const onWheel = (e: WheelEvent) => {
            if (Date.now() < cooldownUntil) {
                return;
            }
            if ((e.target as Element | null)?.closest('[data-pc-episode-aside]')) {
                return;
            }
            if (idleTimer) {
                clearTimeout(idleTimer);
            }
            idleTimer = setTimeout(() => {
                accY = 0;
                idleTimer = null;
            }, IDLE_RESET_MS);
            accY += e.deltaY;
            if (accY > TH) {
                accY = 0;
                cooldownUntil = Date.now() + COOLDOWN_MS;
                if (current < data.episodes.length - 1) {
                    handleSetEpisode(current + 1);
                }
            } else if (accY < -TH) {
                accY = 0;
                cooldownUntil = Date.now() + COOLDOWN_MS;
                if (current > 0) {
                    handleSetEpisode(current - 1);
                }
            }
        };
        list.addEventListener('wheel', onWheel, { passive: true });
        return () => {
            list.removeEventListener('wheel', onWheel);
            if (idleTimer) {
                clearTimeout(idleTimer);
            }
        };
    }, [enabled, data, initialized, listRef, current, handleSetEpisode]);
}
