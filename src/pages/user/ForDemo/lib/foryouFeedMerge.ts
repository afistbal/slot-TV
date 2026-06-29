import type { IForYouFeedItem } from '@/types/foryouFeed';

export function foryouFeedItemKey(item: Pick<IForYouFeedItem, 'id' | 'ep_id'>): string {
    return `${item.id}-${item.ep_id}`;
}

/** 追加加载：原样拼接，推荐池跨页重复 id/ep_id 由后端设计，前端不去重 */
export function mergeForyouFeedItems(
    base: IForYouFeedItem[],
    incoming: IForYouFeedItem[],
): IForYouFeedItem[] {
    if (!incoming.length) {
        return base;
    }
    return [...base, ...incoming];
}
