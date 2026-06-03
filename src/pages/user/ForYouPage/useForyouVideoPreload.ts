import { useEffect } from 'react';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import {
    FORYOU_HIDDEN_PRELOAD_BELOW_OFFSET,
    FORYOU_PLAYER_WINDOW_NEXT,
    FORYOU_PLAYER_WINDOW_PREV,
} from './foryouConstants';
import { prewarmForyouFeedItem, syncForyouPrewarmWindow } from './foryouFeedMedia';

/**
 * For You：当前条起播后隐藏预拉 anchor+3（metadata）。
 * anchor±1 由邻格 ForYouPlayer preload=auto；+2 邻格 metadata。
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

        if (!list.length || anchorIndex < 0) {
            return;
        }

        const cleanups: Array<() => void> = [];

        /** 当前条在播时，对再下 1 条（+2 邻格）提前 metadata，缩短连滑两条时的空档 */
        const nearIdx = anchorIndex + 2;
        if (anchorPlaybackReady && nearIdx >= 0 && nearIdx < list.length) {
            cleanups.push(prewarmForyouFeedItem(list[nearIdx], staticBase, 'metadata'));
        }

        const farIdx = anchorIndex + FORYOU_HIDDEN_PRELOAD_BELOW_OFFSET;
        if (anchorPlaybackReady && farIdx >= 0 && farIdx < list.length) {
            cleanups.push(prewarmForyouFeedItem(list[farIdx], staticBase, 'metadata'));
        }

        return () => {
            for (const fn of cleanups) {
                fn();
            }
        };
    }, [list, anchorIndex, staticBase, anchorPlaybackReady]);
}
