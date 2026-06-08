import type { IForYouFeedItem } from '@/types/foryouFeed';

export function foryouFeedItemKey(item: Pick<IForYouFeedItem, 'id' | 'ep_id'>): string {
    return `${item.id}-${item.ep_id}`;
}

/** 追加加载时去重，避免与当前列表重复 */
export function mergeForyouFeedItems(
    base: IForYouFeedItem[],
    incoming: IForYouFeedItem[],
): IForYouFeedItem[] {
    if (!incoming.length) {
        return base;
    }
    const seen = new Set(base.map(foryouFeedItemKey));
    const appended: IForYouFeedItem[] = [];
    for (const row of incoming) {
        const key = foryouFeedItemKey(row);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        appended.push(row);
    }
    return appended.length ? [...base, ...appended] : base;
}
