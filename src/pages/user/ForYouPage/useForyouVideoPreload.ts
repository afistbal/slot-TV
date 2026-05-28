import { useEffect } from 'react';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import { prewarmForyouFeedItem } from './foryouFeedMedia';

/** 预拉当前条上下各 1～2 条的 mp4 metadata（不挂 ForYouPlayer，省内存） */
export function useForyouVideoPreload(
    list: IForYouFeedItem[],
    activeIndex: number,
    staticBase: string,
) {
    useEffect(() => {
        if (!list.length) {
            return;
        }
        const cleanups: Array<() => void> = [];
        for (const offset of [-1, 1, 2]) {
            const idx = activeIndex + offset;
            if (idx < 0 || idx >= list.length) {
                continue;
            }
            cleanups.push(prewarmForyouFeedItem(list[idx], staticBase));
        }
        return () => {
            for (const fn of cleanups) {
                fn();
            }
        };
    }, [list, activeIndex, staticBase]);
}
