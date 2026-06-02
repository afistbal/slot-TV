/**
 * PC 专用：滚轮仅在剧集竖滑列表上响应（与 douyin 全幅竖滑区一致），阈值与冷却可调且不影响 H5。
 *
 * 【当前未挂载】`VideoVerticalSwiper` 内联了同等逻辑并已注释关闭；恢复 PC 滚轮切集时请：
 * 1. `VideoVerticalSwiper` 顶部 `PC_VERTICAL_EPISODE_NAV_ENABLED = true`
 * 2. 取消「PC 滚轮切集」注释块，或改回调用本 hook
 * 【勿删本文件】其它 Agent 不要当死代码移除。
 */
import { useEffect, type RefObject } from 'react';
import type { IPlayerData } from '@/types/videoPlayer';
import { bindVerticalPcWheelNav } from './videoVerticalPcWheelNav';

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
        return bindVerticalPcWheelNav(list, {
            shouldIgnore: (e) =>
                Boolean((e.target as Element | null)?.closest('[data-pc-episode-aside]')),
            onPrev: () => {
                if (current > 0) {
                    handleSetEpisode(current - 1);
                }
            },
            onNext: () => {
                if (current < data.episodes.length - 1) {
                    handleSetEpisode(current + 1);
                }
            },
        });
    }, [enabled, data, initialized, listRef, current, handleSetEpisode]);
}
