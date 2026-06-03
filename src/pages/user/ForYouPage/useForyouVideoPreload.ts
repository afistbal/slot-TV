import { useEffect } from 'react';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import {
    FORYOU_HIDDEN_PRELOAD_BELOW_OFFSET,
    FORYOU_PLAYER_WINDOW_NEXT,
    FORYOU_PLAYER_WINDOW_PREV,
} from './foryouConstants';
import { prewarmForyouFeedItem, syncForyouPrewarmWindow } from './foryouFeedMedia';

/**
 * For You：当前条 canplay 后，隐藏预拉 anchor+3（metadata）。
 * anchor-1～+2 由邻格 ForYouPlayer 承担（上 1 / 下 2）。
 */
export function useForyouVideoPreload(
    list: IForYouFeedItem[],
    anchorIndex: number,
    staticBase: string,
    anchorPlaybackReady: boolean,
) {
    useEffect(() => {
        const keepIds = new Set<number>();
        for (
            let i = Math.max(0, anchorIndex - FORYOU_PLAYER_WINDOW_PREV);
            i <= anchorIndex + FORYOU_PLAYER_WINDOW_NEXT;
            i += 1
        ) {
            const item = list[i];
            if (item) {
                keepIds.add(item.ep_id);
            }
        }
        syncForyouPrewarmWindow([...keepIds]);

        if (!anchorPlaybackReady || !list.length || anchorIndex < 0) {
            return;
        }

        const idx = anchorIndex + FORYOU_HIDDEN_PRELOAD_BELOW_OFFSET;
        if (idx < 0 || idx >= list.length) {
            return;
        }

        const detach = prewarmForyouFeedItem(list[idx], staticBase, 'metadata');
        return () => {
            detach();
        };
    }, [list, anchorIndex, staticBase, anchorPlaybackReady]);
}
