import { useEffect } from 'react';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import { prewarmForyouFeedItem, syncForyouPrewarmWindow } from './foryouFeedMedia';

/** 下一条由邻格 ForYouPlayer（metadata）；隐藏 video 负责 +2 */
const FORYOU_HIDDEN_PRELOAD_OFFSET = 2;

/**
 * For You：当前条 canplay 后，隐藏预拉 anchor+2（metadata）。
 * anchor+1 由邻格 ForYouPlayer 承担；H5 仅挂载 [active, active+1] 不挂上一集。
 */
export function useForyouVideoPreload(
    list: IForYouFeedItem[],
    anchorIndex: number,
    staticBase: string,
    anchorPlaybackReady: boolean,
) {
    useEffect(() => {
        const keepIds = new Set<number>();
        for (let i = Math.max(0, anchorIndex - 1); i <= anchorIndex + 2; i += 1) {
            const item = list[i];
            if (item) {
                keepIds.add(item.ep_id);
            }
        }
        syncForyouPrewarmWindow([...keepIds]);

        if (!anchorPlaybackReady || !list.length || anchorIndex < 0) {
            return;
        }

        const idx = anchorIndex + FORYOU_HIDDEN_PRELOAD_OFFSET;
        if (idx < 0 || idx >= list.length) {
            return;
        }

        const detach = prewarmForyouFeedItem(list[idx], staticBase, 'metadata');
        return () => {
            detach();
        };
    }, [list, anchorIndex, staticBase, anchorPlaybackReady]);
}
